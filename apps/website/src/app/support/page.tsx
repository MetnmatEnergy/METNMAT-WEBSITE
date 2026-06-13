import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportClient } from "@/frontend/components/support/support-client";

export const metadata: Metadata = {
  title: "Support — Raise & track a ticket",
  description:
    "Get help with your METNMAT order. Raise a support ticket for order issues, product quality, shipping, payments or technical questions — and track its status any time.",
};

export default function SupportPage() {
  return (
    <Suspense>
      <SupportClient />
    </Suspense>
  );
}
