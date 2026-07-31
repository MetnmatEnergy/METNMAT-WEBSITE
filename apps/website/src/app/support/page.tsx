import { Suspense } from "react";
import { SupportClient } from "@/frontend/components/support/support-client";
import { Container } from "@/frontend/components/ui/container";
import { PageBreadcrumbs } from "@/frontend/components/seo/page-breadcrumbs";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata = pageMetadata({
  title: "Support — Raise & track a ticket",
  description:
    "Get help with your METNMAT order. Raise a support ticket for order issues, product quality, shipping, payments or technical questions — and track its status any time.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <>
      <Container className="pt-6">
        <PageBreadcrumbs items={[{ name: "Home", path: "/" }, { name: "Support", path: "/support" }]} />
      </Container>
      <Suspense>
        <SupportClient />
      </Suspense>
    </>
  );
}
