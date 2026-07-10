import { ProfileForm } from "@/frontend/components/commerce/profile-form";
import { PasswordForm } from "@/frontend/components/commerce/password-form";
import { SetPasswordForm } from "@/frontend/components/commerce/set-password-form";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();
  // A Google-created account has no password the customer knows, so the normal
  // change-password form (which verifies the current one) is unusable for them —
  // offer to create one instead. Once set, authProvider flips to "linked" and this
  // becomes the ordinary change-password card.
  const needsPassword = customer?.authProvider === "google";

  return (
    <div className="space-y-6">
      <ProfileForm
        initial={{
          userCode: customer?.userCode,
          avatar: customer?.avatar,
          name: customer?.name,
          email: customer?.email,
          phone: customer?.phone,
          company: customer?.company,
          gstin: customer?.gstin,
          role: customer?.role,
        }}
      />
      {needsPassword ? (
        <SetPasswordForm email={customer?.email ?? ""} mode="settings" />
      ) : (
        <PasswordForm />
      )}
    </div>
  );
}
