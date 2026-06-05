"use client";

import * as React from "react";
import { unitPriceForQty, type Product } from "@/frontend/lib/catalog";

// Cart/wishlist store a product SNAPSHOT taken at add-time (denormalized) so the
// website no longer depends on static catalog data — products come from the CMS.
type CartItem = { qty: number; product: Product };
type CartLine = { slug: string; qty: number; product: Product; unitPrice: number; lineTotal: number };

type Store = {
  cart: CartItem[];
  addToCart: (product: Product, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartLines: CartLine[];
  cartSubtotal: number;
  wishlist: Product[];
  toggleWishlist: (product: Product) => void;
  inWishlist: (slug: string) => boolean;
  wishlistCount: number;
};

const StoreContext = React.createContext<Store | null>(null);
const CART_KEY = "mm-cart";
const WISH_KEY = "mm-wishlist";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [wishlist, setWishlist] = React.useState<Product[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      // Sanitize: drop any legacy/invalid entries (old {slug,qty} shape, strings).
      const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      setCart(
        Array.isArray(c) ? c.filter((i) => i && i.product && i.product.slug) : []
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
    setCart((prev) => {
      const existing = prev.find((i) => i.product.slug === product.slug);
      if (existing) {
        return prev.map((i) =>
          i.product.slug === product.slug ? { ...i, qty: i.qty + qty, product } : i
        );
      }
      return [...prev, { product, qty }];
    });
  }, []);

  const setQty = React.useCallback((slug: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.slug === slug ? { ...i, qty: Math.max(1, qty) } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const removeFromCart = React.useCallback(
    (slug: string) => setCart((prev) => prev.filter((i) => i.product.slug !== slug)),
    []
  );
  const clearCart = React.useCallback(() => setCart([]), []);

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
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    cartCount: cart.reduce((n, i) => n + i.qty, 0),
    cartLines,
    cartSubtotal: cartLines.reduce((n, l) => n + l.lineTotal, 0),
    wishlist,
    toggleWishlist,
    inWishlist: (slug) => wishlist.some((p) => p.slug === slug),
    wishlistCount: wishlist.length,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
