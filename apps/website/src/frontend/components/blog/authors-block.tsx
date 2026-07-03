import Image from "next/image";
import { ExternalLink, GraduationCap, Linkedin, Mail } from "lucide-react";
import type { BlogAuthorProfile } from "@/frontend/lib/blog";

/** External profile link with safe attributes. */
function ProfileLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      {children}
    </a>
  );
}

/**
 * "About the authors" — professional identity block (photo, designation,
 * affiliation, bio, ORCID / Scholar / ResearchGate / LinkedIn links).
 */
export function AuthorsBlock({
  authors,
  correspondingAuthorId,
  legacyAuthor,
}: {
  authors: BlogAuthorProfile[];
  correspondingAuthorId?: string;
  legacyAuthor?: string;
}) {
  if (!authors.length && !legacyAuthor) return null;

  return (
    <section aria-labelledby="authors-heading" className="mt-12 border-t border-border pt-8">
      <h2 id="authors-heading" className="font-display text-xl font-semibold">
        About the author{authors.length > 1 ? "s" : ""}
      </h2>
      <div className="mt-5 space-y-6">
        {authors.map((a) => (
          <div key={a.id} className="flex gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {a.photoUrl ? (
                <Image src={a.photoUrl} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span aria-hidden className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-brand-soft">
                  {a.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {a.name}
                {a.id === correspondingAuthorId && (
                  <span className="ml-2 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-soft">
                    Corresponding author
                  </span>
                )}
                {!a.isMetnmatAuthor && (
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contributor
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {[a.designation, a.organisation, a.department].filter(Boolean).join(" · ")}
              </p>
              {a.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.bio}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.orcidUrl && (
                  <ProfileLink href={a.orcidUrl} label={`${a.name} on ORCID`}>
                    <ExternalLink aria-hidden className="h-3 w-3" /> ORCID
                  </ProfileLink>
                )}
                {a.googleScholarUrl && (
                  <ProfileLink href={a.googleScholarUrl} label={`${a.name} on Google Scholar`}>
                    <GraduationCap aria-hidden className="h-3 w-3" /> Scholar
                  </ProfileLink>
                )}
                {a.researchGateUrl && (
                  <ProfileLink href={a.researchGateUrl} label={`${a.name} on ResearchGate`}>
                    <ExternalLink aria-hidden className="h-3 w-3" /> ResearchGate
                  </ProfileLink>
                )}
                {a.linkedinUrl && (
                  <ProfileLink href={a.linkedinUrl} label={`${a.name} on LinkedIn`}>
                    <Linkedin aria-hidden className="h-3 w-3" /> LinkedIn
                  </ProfileLink>
                )}
                {a.websiteUrl && (
                  <ProfileLink href={a.websiteUrl} label={`${a.name}'s profile page`}>
                    <ExternalLink aria-hidden className="h-3 w-3" /> Profile
                  </ProfileLink>
                )}
                {a.email && (
                  <a
                    href={`mailto:${a.email}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                  >
                    <Mail aria-hidden className="h-3 w-3" /> Email
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {!authors.length && legacyAuthor && (
          <p className="text-sm text-muted-foreground">{legacyAuthor}</p>
        )}
      </div>
    </section>
  );
}
