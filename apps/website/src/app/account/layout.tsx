import { redirect } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { AccountNav } from "@/frontend/components/commerce/account-nav";
import { getCurrentCustomer } from "@/backend/lib/customer";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?redirect=/account");

  return (
    <Container className="py-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground/90">{customer.name || customer.email}</span>
        </p>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AccountNav />
        </aside>
        <div>{children}</div>
      </div>
    </Container>
  );
}
