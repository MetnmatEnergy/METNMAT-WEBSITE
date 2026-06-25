import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/backend/lib/customer";

/**
 * The signed-in customer's own profile + saved addresses, for prefilling the
 * checkout form. Returns `{ customer: null }` (not an error) when signed out, so
 * the client can degrade gracefully.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const c = await getCurrentCustomer();
  if (!c) return NextResponse.json({ customer: null });
  return NextResponse.json({
    customer: {
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      gstin: c.gstin ?? "",
      addresses: c.addresses ?? [],
    },
  });
}
