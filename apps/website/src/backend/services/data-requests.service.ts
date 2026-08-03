/**
 * Data Principal rights requests (DPDP Act, 2023) — persisted to the dashboard
 * CMS `data-requests` collection, which allows public create.
 *
 * The CMS mints the reference, receivedAt and dueAt in a beforeChange hook, so
 * the SLA clock starts from the server's clock and cannot be spoofed by the
 * client. This service returns the reference so the requester can be told it.
 */
const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

export const DATA_REQUEST_TYPES = [
  "access",
  "correction",
  "erasure",
  "withdraw",
  "nominate",
  "grievance",
] as const;

export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number];

export type DataRequestInput = {
  type: DataRequestType;
  name: string;
  email: string;
  phone?: string;
  details?: string;
};

/** Returns the reference on success, or null so the caller can fail loudly. */
export async function createDataRequest(input: DataRequestInput): Promise<string | null> {
  try {
    const res = await fetch(`${CMS}/api/data-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        details: input.details,
        status: "new",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { doc?: { reference?: string } };
    return json?.doc?.reference ?? null;
  } catch {
    // Never throw into the route — it decides what the requester is told.
    return null;
  }
}
