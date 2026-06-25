import { ProfileForm } from "@/frontend/components/commerce/profile-form";
import { PasswordForm } from "@/frontend/components/commerce/password-form";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();
  return (
    <div className="space-y-6">
      <ProfileForm
        initial={{
          name: customer?.name,
          email: customer?.email,
          phone: customer?.phone,
          company: customer?.company,
          gstin: customer?.gstin,
        }}
      />
      <PasswordForm />
    </div>
  );
}
