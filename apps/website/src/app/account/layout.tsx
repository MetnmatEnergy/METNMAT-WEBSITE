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
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            Signed in as{" "}
            <span className="font-medium text-foreground/90">{customer.name || customer.email}</span>
          </span>
          {customer.userCode ? (
            <span
              title="Your permanent METNMAT member ID"
              className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-mono text-xs font-medium text-foreground/80"
            >
              {customer.userCode}
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <AccountNav />
        </aside>
        {/* min-w-0: a grid item's default min-width:auto refuses to shrink below its
            content's min-content (long email/ID strings), which would overflow the
            track and cause horizontal scroll on mobile. */}
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
