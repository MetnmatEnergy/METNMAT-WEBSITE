import { AddressBook } from "@/frontend/components/commerce/address-book";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const customer = await getCurrentCustomer();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Saved addresses speed up checkout. The default is used first.
      </p>
      <AddressBook initial={customer?.addresses ?? []} />
    </div>
  );
}
