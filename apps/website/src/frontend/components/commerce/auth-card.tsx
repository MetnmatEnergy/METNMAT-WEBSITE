"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  ShieldCheck,
  FileText,
  GraduationCap,
  BadgeCheck,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { TextField, SelectField } from "@/frontend/components/ui/field";

/** Audience roles — mirrors the CMS `role` select on the customers collection. */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Role (optional)" },
  { value: "student", label: "Student" },
  { value: "phd", label: "PhD / Research Scholar" },
  { value: "faculty", label: "Faculty / Professor" },
  { value: "scientist", label: "Scientist / R&D" },
  { value: "procurement", label: "Institution / Procurement" },
  { value: "industry", label: "Industry" },
  { value: "other", label: "Other" },
];

/** Friendly copy for ?error= codes returned by the Google callback. */
const OAUTH_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't complete. Please try again.",
  google_unavailable: "Google sign-in isn't available right now — please use email.",
  google_rate: "Too many attempts. Please wait a moment and try again.",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Official multi-colour Google "G". */
function GoogleG() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.638-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/** Continue-with-Google button. A full navigation (not fetch) — OAuth needs a
 *  top-level redirect — carrying the post-login destination through. */
function GoogleButton({ redirectTo, label }: { redirectTo: string; label: string }) {
  return (
    <a
      href={`/api/account/google/start?redirect=${encodeURIComponent(redirectTo)}`}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      <GoogleG />
      {label}
    </a>
  );
}

/** Left-hand trust panel — speaks to the researcher / lab / institution audience. */
function TrustPanel() {
  const points = [
    { icon: ShieldCheck, text: "Private, secure sessions — your data never leaves METNMAT." },
    { icon: FileText, text: "GST-invoice ready for institutional & grant procurement." },
    { icon: GraduationCap, text: "Trusted by universities, CSIR labs & industry R&D teams." },
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-surface to-surface p-7 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5 text-brand" />
        METNMAT Accounts
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold leading-tight tracking-tight">
        The account for researchers, labs &amp; institutions
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        One place to order lab equipment, request quotes and track your materials-R&amp;D projects —
        built for scholars, PhDs, faculty and procurement teams.
      </p>
      <ul className="mt-6 space-y-3.5">
        {points.map((p) => (
          <li key={p.text} className="flex items-start gap-3 text-sm text-foreground/90">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <p.icon className="h-4 w-4" />
            </span>
            <span className="leading-relaxed">{p.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7 rounded-xl border border-border bg-surface/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
        Every account gets a unique member ID —{" "}
        <span className="font-mono font-medium text-foreground/80">MNM-U-26-000123</span> — for quoting,
        support and orders.
      </div>
    </div>
  );
}

/** Post-registration success — gives the assigned member code a real moment. */
function CreatedPanel({
  userCode,
  signedIn,
  onContinue,
}: {
  userCode: string;
  /** False when the account was created but the auto sign-in didn't take. */
  signedIn: boolean;
  onContinue: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is on screen anyway */
    }
  };
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Check className="h-6 w-6" />
      </div>
      <h1 className="mt-4 font-display text-xl font-bold">
        {signedIn ? "You're all set" : "Account created"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {signedIn
          ? "Your account is ready. This is your permanent METNMAT member ID — keep it handy for quotes and support."
          : "Your account is ready, but we couldn't sign you in automatically. Please sign in to continue. This is your permanent METNMAT member ID — keep it handy for quotes and support."}
      </p>
      {userCode ? (
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="rounded-lg border border-border bg-muted/40 px-3.5 py-2 font-mono text-base font-semibold tracking-wide text-foreground">
            {userCode}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy member ID"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
      <Button onClick={onContinue} className="mt-6 w-full" size="lg">
        {signedIn ? "Continue to your account" : "Sign in to continue"}
      </Button>
    </div>
  );
}

type Form = { name: string; email: string; password: string; phone: string; company: string; role: string };
type FieldErrors = Partial<Record<keyof Form, string>>;

export function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [form, setForm] = React.useState<Form>({ name: "", email: "", password: "", phone: "", company: "", role: "" });
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [showPw, setShowPw] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [created, setCreated] = React.useState<{ userCode: string; signedIn: boolean } | null>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrors((fe) => (fe[k] ? { ...fe, [k]: undefined } : fe));
    setError((prev) => (prev ? "" : prev));
  };

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError("");
    setFieldErrors({});
  };

  // Surface a Google sign-in failure passed back as ?error= by the callback, then
  // strip the param so it doesn't linger over the email form or reappear on refresh.
  React.useEffect(() => {
    const code = params.get("error");
    if (!code) return;
    setError(OAUTH_ERRORS[code] || "Something went wrong. Please try again.");
    const next = new URLSearchParams(params.toString());
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false });
  }, [params, router]);

  function validate(): boolean {
    const fe: FieldErrors = {};
    if (mode === "register" && !form.name.trim()) fe.name = "Please enter your name.";
    if (!form.email.trim()) fe.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) fe.email = "Enter a valid email address.";
    if (!form.password) fe.password = "Password is required.";
    else if (mode === "register" && form.password.length < 8) fe.password = "Use at least 8 characters.";
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    const endpoint = mode === "login" ? "/api/account/login" : "/api/account/register";
    const payload =
      mode === "login"
        ? { email: form.email.trim(), password: form.password }
        : {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim(),
            company: form.company.trim(),
            role: form.role,
          };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        signedIn?: boolean;
        userCode?: string;
        error?: string;
      };
      if (res.ok && data?.success) {
        if (mode === "register") {
          // Show the assigned member code before moving on. `signedIn` tells us
          // whether a session actually exists — if not, send them to sign in
          // rather than bouncing off the account gate.
          setLoading(false);
          setCreated({ userCode: data.userCode || "", signedIn: data.signedIn !== false });
          return;
        }
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setError(data?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error — please try again.");
    }
    setLoading(false);
  }

  function continueAfterSignup() {
    if (created && !created.signedIn) {
      // No session was established — the account gate would just bounce them.
      setCreated(null);
      switchMode("login");
      setForm((f) => ({ ...f, password: "" }));
      setError("Your account was created. Please sign in to continue.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-5xl items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
      {/* Trust panel — second on mobile, first on desktop. */}
      <div className="order-2 lg:order-1">
        <TrustPanel />
      </div>

      {/* Form card */}
      <div className="order-1 lg:order-2">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {created !== null ? (
            <CreatedPanel userCode={created.userCode} signedIn={created.signedIn} onContinue={continueAfterSignup} />
          ) : (
            <>
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-sm font-medium">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={loading}
                    onClick={() => switchMode(m)}
                    className={`rounded-lg py-2 transition-colors disabled:opacity-60 ${
                      mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <h1 className="mt-6 font-display text-xl font-bold">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Sign in to track orders, RFQs and saved addresses."
                  : "One account for orders, quote requests and faster checkout."}
              </p>

              <div className="mt-6">
                <GoogleButton redirectTo={redirectTo} label={mode === "login" ? "Continue with Google" : "Sign up with Google"} />
              </div>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                or continue with email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} noValidate className="grid gap-3.5">
                {mode === "register" && (
                  <TextField
                    label="Full name"
                    placeholder="e.g. Dr. Anita Rao"
                    value={form.name}
                    onChange={set("name")}
                    error={fieldErrors.name}
                    autoComplete="name"
                  />
                )}
                <TextField
                  label="Email"
                  type="email"
                  placeholder="you@university.edu"
                  value={form.email}
                  onChange={set("email")}
                  error={fieldErrors.email}
                  hint={mode === "register" ? "Academic or work email preferred." : undefined}
                  autoComplete="email"
                  inputMode="email"
                />
                <TextField
                  label="Password"
                  labelHint={
                    mode === "login" ? (
                      <Link href="/forgot" className="font-medium text-brand hover:underline">
                        Forgot password?
                      </Link>
                    ) : undefined
                  }
                  type={showPw ? "text" : "password"}
                  placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                  value={form.password}
                  onChange={set("password")}
                  error={fieldErrors.password}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {mode === "register" && (
                  <>
                    <TextField
                      label="Institution / Organisation"
                      labelHint="optional"
                      placeholder="University, lab or company"
                      value={form.company}
                      onChange={set("company")}
                      autoComplete="organization"
                    />
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <SelectField label="Role" value={form.role} onChange={set("role")}>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        label="Phone"
                        labelHint="optional"
                        placeholder="Phone number"
                        value={form.phone}
                        onChange={set("phone")}
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="mt-1 w-full" size="lg">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "login" ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "login" ? "New to METNMAT? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                  className="font-semibold text-brand hover:underline"
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
              {mode === "register" && (
                <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                  By creating an account you agree to our{" "}
                  <Link href="/terms" className="underline hover:text-foreground">terms</Link> and{" "}
                  <Link href="/privacy" className="underline hover:text-foreground">privacy policy</Link>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
