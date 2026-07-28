"use client";

import * as React from "react";
import { Container } from "@/frontend/components/ui/container";
import { AuthCard } from "@/frontend/components/commerce/auth-card";

/**
 * Create-account page. Renders the same card as /login but opens on the
 * "Create account" pane, so "Sign up" in the header lands where the user
 * expects instead of on the sign-in form.
 */
export default function SignupPage() {
  return (
    <Container className="py-12 sm:py-16">
      <React.Suspense
        fallback={<div className="mx-auto max-w-md text-center text-muted-foreground">Loading…</div>}
      >
        <AuthCard initialMode="register" />
      </React.Suspense>
    </Container>
  );
}
