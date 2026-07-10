import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { SetPasswordForm } from "@/frontend/components/commerce/set-password-form";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add a password",
  robots: { index: false, follow: false },
};

/**
 * Only ever a RELATIVE path on our own site. A `next` of `//evil.com` or
 * `https://evil.com` would otherwise turn this page into an open redirect.
 */
function safeNext(raw?: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/account";
  return raw;
}

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);

  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/login?redirect=${encodeURIComponent("/set-password")}`);

  // Anyone who already chose a password ("local" / "linked") has nothing to do
  // here — and must not be able to set one without proving the current one.
  if (customer.authProvider !== "google") redirect(destination);

  return (
    <Container className="py-12 sm:py-16">
      <SetPasswordForm email={customer.email ?? ""} next={destination} mode="onboarding" />
    </Container>
  );
}
