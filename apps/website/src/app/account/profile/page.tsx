import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

export default function ProfilePage() {
  // TODO(feature): load + save the signed-in user's profile.
  return (
    <Card className="max-w-xl">
      <h2 className="font-display text-lg font-semibold">Profile</h2>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={field} placeholder="Full name" />
          <input className={field} placeholder="Email" type="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={field} placeholder="Phone" />
          <input className={field} placeholder="Company" />
        </div>
        <input className={field} placeholder="GSTIN (optional)" />
        <Button type="button" className="justify-self-start">Save changes</Button>
      </div>
    </Card>
  );
}
