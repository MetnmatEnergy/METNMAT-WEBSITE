import { Container } from "@/frontend/components/ui/container";
import { AccountNav } from "@/frontend/components/commerce/account-nav";

// TODO(feature): protect /account behind auth (JWT) once login exists.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">My account</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AccountNav />
        </aside>
        <div>{children}</div>
      </div>
    </Container>
  );
}
