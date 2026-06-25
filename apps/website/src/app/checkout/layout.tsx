import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/backend/lib/customer";

/**
 * Checkout requires a signed-in customer (like a marketplace). Anyone who hits
 * /checkout — via "Proceed to checkout", the cart rail, or a direct URL — is
 * sent to sign in / create an account first, then bounced straight back here.
 * Gating server-side (not just hiding a button) is the only safe way: the
 * session lives in an httpOnly cookie the client can't read.
 */
export const dynamic = "force-dynamic";

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?redirect=/checkout");
  return <>{children}</>;
}
