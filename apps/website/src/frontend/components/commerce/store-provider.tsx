"use client";

import * as React from "react";
import { unitPriceForQty, clampQty, isQuoteOnly, type Product } from "@/frontend/lib/catalog";

// Cart/wishlist store a product SNAPSHOT taken at add-time (denormalized) so the
// website no longer depends on static catalog data — products come from the CMS.
type CartItem = { qty: number; product: Product };
type CartLine = { slug: string; qty: number; product: Product; unitPrice: number; lineTotal: number };

type Store = {
  cart: CartItem[];
  /** True once localStorage has been read — guards against a "false empty" flash. */
  ready: boolean;
  addToCart: (product: Product, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartLines: CartLine[];
  cartSubtotal: number;
  /** Quick-cart drawer (mobile + click-to-open). */
  cartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  wishlist: Product[];
  toggleWishlist: (product: Product) => void;
  inWishlist: (slug: string) => boolean;
  wishlistCount: number;
  /** Last removed item, for the "Undo" toast. */
  lastRemoved: CartItem | null;
  undoRemove: () => void;
  dismissRemoved: () => void;
};

const StoreContext = React.createContext<Store | null>(null);
const CART_KEY = "mm-cart";
const WISH_KEY = "mm-wishlist";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [wishlist, setWishlist] = React.useState<Product[]>([]);
  const [ready, setReady] = React.useState(false);
  const [lastRemoved, setLastRemoved] = React.useState<CartItem | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = React.useState(false);
  const openCartDrawer = React.useCallback(() => setCartDrawerOpen(true), []);
  const closeCartDrawer = React.useCallback(() => setCartDrawerOpen(false), []);

  React.useEffect(() => {
    try {
      // Sanitize: drop any legacy/invalid entries (old {slug,qty} shape, strings)
      // and self-heal each line's qty to its MOQ/cap so a stale cart can never
      // show a quantity the server would silently change at checkout.
      const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setCart(
        Array.isArray(c)
          ? c
              .filter((i) => i && i.product && i.product.slug)
              .map((i) => ({ ...i, qty: clampQty(i.product, i.qty) }))
          : []
      );
      const w = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
      setWishlist(
        Array.isArray(w) ? w.filter((p) => p && typeof p === "object" && p.slug) : []
      );
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, ready]);
  React.useEffect(() => {
    if (ready) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, ready]);

  const addToCart = React.useCallback((product: Product, qty = 1) => {
    // Quote-only items (no price) can't be bought online — they go through RFQ.
    if (isQuoteOnly(product)) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.slug === product.slug);
      if (existing) {
        // clampQty floors to MOQ and caps at MAX_ORDER_QTY, so the cart qty can
        // never be a value the server will silently change at checkout.
        return prev.map((i) =>
          i.product.slug === product.slug
            ? { ...i, qty: clampQty(product, i.qty + qty), product }
            : i
        );
      }
      return [...prev, { product, qty: clampQty(product, qty) }];
    });
  }, []);

  const setQty = React.useCallback((slug: string, qty: number) => {
    // Floor to the product's MOQ (never below) and cap at MAX_ORDER_QTY, so the
    // displayed quantity always matches what gets charged. Removal goes through
    // removeFromCart (e.g. the cart-rail trash action at MOQ).
    setCart((prev) =>
      prev.map((i) => (i.product.slug === slug ? { ...i, qty: clampQty(i.product, qty) } : i))
    );
  }, []);

  const removeFromCart = React.useCallback((slug: string) => {
    setCart((prev) => {
      const removed = prev.find((i) => i.product.slug === slug);
      if (removed) setLastRemoved(removed);
      return prev.filter((i) => i.product.slug !== slug);
    });
  }, []);
  const clearCart = React.useCallback(() => setCart([]), []);

  const undoRemove = React.useCallback(() => {
    setLastRemoved((removed) => {
      if (removed) {
        setCart((prev) =>
          prev.some((i) => i.product.slug === removed.product.slug) ? prev : [...prev, removed]
        );
      }
      return null;
    });
  }, []);
  const dismissRemoved = React.useCallback(() => setLastRemoved(null), []);

  const toggleWishlist = React.useCallback((product: Product) => {
    setWishlist((prev) =>
      prev.some((p) => p.slug === product.slug)
        ? prev.filter((p) => p.slug !== product.slug)
        : [...prev, product]
    );
  }, []);

  const cartLines: CartLine[] = cart
    .filter((item) => item && item.product && item.product.slug)
    .map((item) => {
      const unitPrice = unitPriceForQty(item.product, item.qty);
    return {
      slug: item.product.slug,
      qty: item.qty,
      product: item.product,
      unitPrice,
      lineTotal: unitPrice * item.qty,
    };
  });

  const value: Store = {
    cart,
    ready,
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    cartCount: cart.reduce((n, i) => n + i.qty, 0),
    cartLines,
    cartSubtotal: cartLines.reduce((n, l) => n + l.lineTotal, 0),
    cartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
    wishlist,
    toggleWishlist,
    inWishlist: (slug) => wishlist.some((p) => p.slug === slug),
    wishlistCount: wishlist.length,
    lastRemoved,
    undoRemove,
    dismissRemoved,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
