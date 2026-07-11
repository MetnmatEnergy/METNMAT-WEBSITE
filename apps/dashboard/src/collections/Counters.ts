import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

/**
 * Atomic sequence counters (system-managed). One document per counter key, each
 * holding a monotonically increasing `seq`. Rows are minted and incremented ONLY
 * via an atomic Mongo `$inc` inside collection hooks (see hooks/customer-code.ts),
 * never through the admin UI — so concurrent writers can never receive the same
 * number. Currently backs the MNM-U-YY customer codes; reusable for future
 * per-year serials (invoices, quotations, …).
 */
export const Counters: CollectionConfig = {
  slug: "counters",
  admin: {
    group: "Administration",
    useAsTitle: "key",
    defaultColumns: ["key", "seq", "updatedAt"],
    description: "Atomic sequence counters (system-managed — do not edit by hand).",
    hidden: ({ user }) => !user,
  },
  access: {
    read: isAdmin,
    // Fully system-managed: rows are born and incremented ONLY by the atomic $inc
    // in hooks. Deleting a counter would reset its sequence and re-mint duplicate
    // codes, so deletion is disallowed entirely (even for admins).
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: "Counter identifier, e.g. customer-userCode-26." },
    },
    {
      name: "seq",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { readOnly: true, description: "Last issued sequence value." },
    },
  ],
};
