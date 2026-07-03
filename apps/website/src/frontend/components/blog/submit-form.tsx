"use client";

/**
 * "Request to Publish" form. Client-side niceties only — the server route
 * re-validates everything (fields, declarations, file types via magic bytes,
 * sizes, rate limits, duplicates). On success shows the submission reference.
 */
import React from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import type { FilterOption } from "@/frontend/components/blog/blog-toolbar";

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const ACCEPT = ".pdf,.doc,.docx,.odt,.xlsx,.png,.jpg,.jpeg,.webp";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-red-500";
const areaCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-red-500";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";
const hintCls = "mt-1 text-xs text-muted-foreground";
const errCls = "mt-1 text-xs text-red-500";

type Errors = Record<string, string>;

function Field({
  name,
  label,
  required,
  hint,
  errors,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  errors: Errors;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
        {required ? <span aria-hidden className="text-brand"> *</span> : null}
      </label>
      {children}
      {hint && !errors[name] && <p className={hintCls}>{hint}</p>}
      {errors[name] && (
        <p className={errCls} id={`${name}-error`} role="alert">
          {errors[name]}
        </p>
      )}
    </div>
  );
}

export function SubmitForm({
  categories,
  contentTypes,
}: {
  categories: FilterOption[]; // value = CMS id here
  contentTypes: FilterOption[];
}) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);
  const [topError, setTopError] = React.useState("");
  const [reference, setReference] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const successHeadingRef = React.useRef<HTMLHeadingElement>(null);

  // Move keyboard/screen-reader focus to the confirmation when the form
  // unmounts on success — otherwise focus silently drops to <body>.
  React.useEffect(() => {
    if (reference) successHeadingRef.current?.focus();
  }, [reference]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setErrors((e) => ({ ...e, files: "" }));
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setErrors((e) => ({ ...e, files: `Maximum ${MAX_FILES} files.` }));
        break;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setErrors((e) => ({ ...e, files: `"${f.name}" is larger than ${MAX_FILE_MB} MB.` }));
        continue;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setTopError("");
    setErrors({});
    try {
      const data = new FormData(e.currentTarget);
      data.delete("files");
      files.forEach((f) => data.append("files", f));
      const res = await fetch("/api/blog/submit", { method: "POST", body: data });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reference?: string;
        error?: string;
        fields?: Errors;
      };
      if (res.ok && j.ok && j.reference) {
        setReference(j.reference);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErrors(j.fields ?? {});
        setTopError(j.error || "Something went wrong — please try again.");
        const firstKey = Object.keys(j.fields ?? {})[0];
        if (firstKey) document.getElementById(firstKey)?.focus();
      }
    } catch {
      setTopError("Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
        <CheckCircle2 aria-hidden className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 ref={successHeadingRef} tabIndex={-1} className="mt-4 font-display text-2xl font-bold outline-none">
          Publication request submitted
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Your publication request has been submitted successfully. The METNMAT editorial team will
          review the article for technical relevance, originality, quality and publication
          suitability. Submission does not guarantee publication — we will contact you by email
          with the outcome.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">Your reference number</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-brand-soft">{reference}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          A confirmation email has been sent to you. Please quote this reference in any correspondence.
        </p>
        <Button href="/blog" variant="outline" className="mt-8">
          Back to Insights
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-10">
      {topError && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {topError}
        </div>
      )}

      {/* Honeypot — invisible to humans, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="space-y-5">
        <legend className="font-display text-xl font-semibold">Contributor information</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="fullName" label="Full name" required errors={errors}>
            <input id="fullName" name="fullName" required maxLength={160} autoComplete="name" className={inputCls} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "fullName-error" : undefined} />
          </Field>
          <Field name="designation" label="Professional designation" errors={errors} hint="e.g. PhD Scholar, Senior Engineer">
            <input id="designation" name="designation" maxLength={160} className={inputCls} />
          </Field>
          <Field name="organisation" label="Organisation / institution" errors={errors}>
            <input id="organisation" name="organisation" maxLength={200} autoComplete="organization" className={inputCls} />
          </Field>
          <Field name="department" label="Department" errors={errors}>
            <input id="department" name="department" maxLength={160} className={inputCls} />
          </Field>
          <Field name="email" label="Email address" required errors={errors}>
            <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className={inputCls} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
          </Field>
          <Field name="mobile" label="Mobile number" errors={errors}>
            <input id="mobile" name="mobile" type="tel" maxLength={40} autoComplete="tel" className={inputCls} />
          </Field>
          <Field name="country" label="Country" errors={errors}>
            <input id="country" name="country" maxLength={80} autoComplete="country-name" className={inputCls} />
          </Field>
        </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Researcher profiles (optional)</summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field name="orcidUrl" label="ORCID URL" errors={errors}>
              <input id="orcidUrl" name="orcidUrl" type="url" maxLength={300} placeholder="https://orcid.org/…" className={inputCls} aria-invalid={!!errors.orcidUrl} />
            </Field>
            <Field name="googleScholarUrl" label="Google Scholar URL" errors={errors}>
              <input id="googleScholarUrl" name="googleScholarUrl" type="url" maxLength={300} className={inputCls} aria-invalid={!!errors.googleScholarUrl} />
            </Field>
            <Field name="researchGateUrl" label="ResearchGate URL" errors={errors}>
              <input id="researchGateUrl" name="researchGateUrl" type="url" maxLength={300} className={inputCls} aria-invalid={!!errors.researchGateUrl} />
            </Field>
            <Field name="linkedinUrl" label="LinkedIn URL" errors={errors}>
              <input id="linkedinUrl" name="linkedinUrl" type="url" maxLength={300} className={inputCls} aria-invalid={!!errors.linkedinUrl} />
            </Field>
          </div>
        </details>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-xl font-semibold">Article information</legend>
        <Field name="proposedTitle" label="Proposed article title" required errors={errors}>
          <input id="proposedTitle" name="proposedTitle" required maxLength={240} className={inputCls} aria-invalid={!!errors.proposedTitle} aria-describedby={errors.proposedTitle ? "proposedTitle-error" : undefined} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="contentType" label="Article type" required errors={errors}>
            <select id="contentType" name="contentType" required className={inputCls} aria-invalid={!!errors.contentType} defaultValue="">
              <option value="" disabled>
                Select a type…
              </option>
              {contentTypes.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="category" label="Category" required errors={errors}>
            <select id="category" name="category" required className={inputCls} aria-invalid={!!errors.category} defaultValue="">
              <option value="" disabled>
                Select a category…
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field name="researchArea" label="Research area" errors={errors} hint="e.g. PEM electrolysis, copper metallurgy, battery materials">
          <input id="researchArea" name="researchArea" maxLength={200} className={inputCls} />
        </Field>
        <Field name="abstract" label="Abstract / summary" required errors={errors} hint="150–400 words recommended.">
          <textarea id="abstract" name="abstract" required rows={6} maxLength={6000} className={areaCls} aria-invalid={!!errors.abstract} aria-describedby={errors.abstract ? "abstract-error" : undefined} />
        </Field>
        <Field name="keywords" label="Keywords" errors={errors} hint="Comma-separated, up to 8.">
          <input id="keywords" name="keywords" maxLength={400} className={inputCls} />
        </Field>
        <Field name="articleText" label="Full article text (optional if uploading a manuscript)" errors={errors}>
          <textarea id="articleText" name="articleText" rows={10} maxLength={60000} className={areaCls} />
        </Field>
        <Field name="coAuthors" label="Co-authors (names & affiliations)" errors={errors}>
          <textarea id="coAuthors" name="coAuthors" rows={2} maxLength={2000} className={areaCls} />
        </Field>

        {/* Files */}
        <div>
          <span className={labelCls}>Manuscript & supporting files</span>
          <label
            htmlFor="files"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-brand/50"
          >
            <FileUp aria-hidden className="h-6 w-6 text-brand-soft" />
            <span>
              <span className="font-medium text-foreground">Choose files</span> — PDF, DOC, DOCX, ODT,
              XLSX, PNG, JPG, WEBP
            </span>
            <span className="text-xs">Up to {MAX_FILES} files · {MAX_FILE_MB} MB each</span>
            <input
              ref={fileInputRef}
              id="files"
              name="files"
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          {errors.files && (
            <p className={errCls} role="alert">
              {errors.files}
            </p>
          )}
          {files.length > 0 && (
            <ul className="mt-3 space-y-2" aria-label="Selected files">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="truncate">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles(files.filter((x) => x !== f))}
                      className="rounded p-1 hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Disclosures (optional)</summary>
          <div className="mt-4 space-y-5">
            <div className="flex items-start gap-2">
              <input id="previouslyPublished" name="previouslyPublished" type="checkbox" className="mt-1 h-4 w-4 accent-[#d81f26]" />
              <label htmlFor="previouslyPublished" className="text-sm text-muted-foreground">
                This work (or a version of it) has been published elsewhere.
              </label>
            </div>
            <Field name="previousPublicationUrl" label="DOI or previously published URL" errors={errors}>
              <input id="previousPublicationUrl" name="previousPublicationUrl" type="url" maxLength={300} className={inputCls} />
            </Field>
            <Field name="conflictOfInterest" label="Conflict-of-interest declaration" errors={errors}>
              <textarea id="conflictOfInterest" name="conflictOfInterest" rows={2} maxLength={2000} className={areaCls} />
            </Field>
            <Field name="fundingAcknowledgement" label="Funding acknowledgement" errors={errors}>
              <textarea id="fundingAcknowledgement" name="fundingAcknowledgement" rows={2} maxLength={2000} className={areaCls} />
            </Field>
          </div>
        </details>

        <Field name="additionalMessage" label="Message to the METNMAT editorial team" errors={errors}>
          <textarea id="additionalMessage" name="additionalMessage" rows={3} maxLength={4000} className={areaCls} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-semibold">Permissions & declarations</legend>
        {(
          [
            ["authorisedToSubmit", "I confirm that I am authorised to submit this content."],
            ["copyrightConfirmed", "I confirm that this submission does not infringe copyright or third-party rights."],
            ["understandsNoGuarantee", "I understand that submission does not guarantee publication."],
            ["contactConsent", "I permit METNMAT to contact me regarding this submission."],
            ["termsAccepted", "I have read and accept the contributor terms and the privacy policy."],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="flex items-start gap-2">
            <input id={name} name={name} type="checkbox" required className="mt-1 h-4 w-4 accent-[#d81f26]" aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />
            <label htmlFor={name} className="text-sm text-muted-foreground">
              {label}
              <span aria-hidden className="text-brand"> *</span>
            </label>
            {errors[name] && (
              <p className="sr-only" id={`${name}-error`} role="alert">
                {errors[name]}
              </p>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          See our <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">privacy policy</a>. Your
          files are stored privately and reviewed only by the METNMAT editorial team.
        </p>
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit publication request"
          )}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          All submissions are evaluated for technical relevance, originality, clarity, copyright
          compliance and suitability for the METNMAT audience.
        </p>
      </div>
    </form>
  );
}
