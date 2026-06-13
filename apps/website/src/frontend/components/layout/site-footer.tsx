import Link from "next/link";
import { Mail, Phone, Linkedin, Youtube, Facebook } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { site, footerNav } from "@/frontend/lib/site";
import { getSettings, getNavigation } from "@/frontend/lib/cms";

export async function SiteFooter() {
  const [settings, nav] = await Promise.all([getSettings(), getNavigation()]);
  const email = settings.contact.email || site.contact.email;
  const phone = settings.contact.phone || site.contact.phone;
  const social = {
    linkedin: settings.social.linkedin && settings.social.linkedin !== "#" ? settings.social.linkedin : site.social.linkedin,
    youtube: settings.social.youtube && settings.social.youtube !== "#" ? settings.social.youtube : site.social.youtube,
    facebook: settings.social.facebook && settings.social.facebook !== "#" ? settings.social.facebook : site.social.facebook,
  };
  const groups = nav?.footerGroups?.length ? nav.footerGroups : footerNav;
  const tagline = settings.company.tagline || site.tagline;
  const legalName = settings.company.legalName || site.legalName;
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <span className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-metnmat.png"
              alt={`${site.legalName} logo`}
              className="h-9 w-auto"
              width={183}
              height={54}
            />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">{tagline}.</p>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-foreground">
              <Mail className="h-4 w-4" /> {email}
            </a>
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-foreground">
              <Phone className="h-4 w-4" /> {phone}
            </a>
          </div>
          <div className="mt-5 flex items-center gap-4 text-muted-foreground">
            <a href={social.linkedin} aria-label="LinkedIn" className="hover:text-foreground"><Linkedin className="h-5 w-5" /></a>
            <a href={social.youtube} aria-label="YouTube" className="hover:text-foreground"><Youtube className="h-5 w-5" /></a>
            <a href={social.facebook} aria-label="Facebook" className="hover:text-foreground"><Facebook className="h-5 w-5" /></a>
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold">Offices</h3>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            {site.addresses.map((addr) => (
              <p key={addr.label}>
                <span className="font-medium text-foreground/90">{addr.label}</span>
                <br />
                {addr.lines.join(" ")}
              </p>
            ))}
          </div>
        </div>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {legalName}. All rights reserved.
          </p>
          <p className="flex items-center gap-4">
            <Link href="/support" className="hover:text-foreground">Support</Link>
            <Link href="/replacement-policy" className="hover:text-foreground">Replacement Policy</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </p>
        </Container>
      </div>
    </footer>
  );
}
