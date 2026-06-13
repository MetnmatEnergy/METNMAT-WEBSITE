import { ProfileForm } from "@/frontend/components/commerce/profile-form";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();
  return (
    <ProfileForm
      initial={{
        name: customer?.name,
        email: customer?.email,
        phone: customer?.phone,
        company: customer?.company,
        gstin: customer?.gstin,
      }}
    />
  );
}
