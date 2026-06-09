"use client";

import * as React from "react";

export type QuoteProductRef = { name: string; slug: string; sku?: string; size?: string } | null;

type QuoteContextValue = {
  // Drawer (product-specific, slides from right — shop only)
  open: boolean;
  product: QuoteProductRef;
  openQuote: (product?: QuoteProductRef) => void;
  closeQuote: () => void;
  // Modal (general inquiry — site-wide CTAs)
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const QuoteContext = React.createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [product, setProduct] = React.useState<QuoteProductRef>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const openQuote = React.useCallback((p?: QuoteProductRef) => {
    setProduct(p ?? null);
    setOpen(true);
  }, []);
  const closeQuote = React.useCallback(() => setOpen(false), []);

  const openModal = React.useCallback(() => setModalOpen(true), []);
  const closeModal = React.useCallback(() => setModalOpen(false), []);

  return (
    <QuoteContext.Provider value={{ open, product, openQuote, closeQuote, modalOpen, openModal, closeModal }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote() {
  const ctx = React.useContext(QuoteContext);
  if (!ctx) throw new Error("useQuote must be used within <QuoteProvider>");
  return ctx;
}
