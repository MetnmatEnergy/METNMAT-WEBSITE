import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

export default function NotFound() {
  return (
    <section className="section">
      <Container className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <p className="font-display text-6xl font-bold text-brand">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button href="/" className="mt-8">
          Back to home
        </Button>
      </Container>
    </section>
  );
}
