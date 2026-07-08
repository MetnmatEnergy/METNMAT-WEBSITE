"use client";

import * as React from "react";
import { Container } from "@/frontend/components/ui/container";
import { AuthCard } from "@/frontend/components/commerce/auth-card";

export default function LoginPage() {
  return (
    <Container className="py-12 sm:py-16">
      <React.Suspense
        fallback={<div className="mx-auto max-w-md text-center text-muted-foreground">Loading…</div>}
      >
        <AuthCard />
      </React.Suspense>
    </Container>
  );
}
