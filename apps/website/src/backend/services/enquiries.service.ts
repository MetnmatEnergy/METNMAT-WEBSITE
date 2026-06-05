/**
 * Enquiries service — business logic for contact/quote submissions.
 * Route handlers call this; it owns persistence + side effects (email, etc.).
 *
 * TODO(backend): persist to MongoDB (enquiries collection) and trigger the
 * transactional email (Brevo/Resend) + WhatsApp notification per the stack.
 */
import type { Enquiry } from "@/backend/models";
// import { getDb } from "@/backend/db/mongo";

export async function createEnquiry(enquiry: Enquiry): Promise<Enquiry> {
  // --- Real implementation (uncomment once MongoDB is wired) ---
  // const db = await getDb();
  // const doc = { ...enquiry, createdAt: new Date().toISOString() };
  // const res = await (db as any).collection("enquiries").insertOne(doc);
  // return { ...doc, id: res.insertedId.toString() };

  // Skeleton behaviour: log and echo back so the frontend flow can be tested.
  console.log("[backend] createEnquiry (stub):", enquiry);
  return { ...enquiry, id: "stub", createdAt: new Date().toISOString() };
}
