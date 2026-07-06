import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { AmazonIcon, FacebookIcon, LinkedInIcon, YouTubeIcon } from "@/frontend/components/ui/brand-icons";
import { Container } from "@/frontend/components/ui/container";
import { site, footerNav } from "@/frontend/lib/site";
import { getSettings, getNavigation } from "@/frontend/lib/cms";

const bottomLinks = [
  { text: "Support", url: "/support" },
  { text: "Replacement Policy", url: "/replacement-policy" },
  { text: "Privacy", url: "/privacy" },
  { text: "Terms", url: "/terms" },
];

export async function SiteFooter() {
  const [settings, nav] = await Promise.all([getSettings(), getNavigation()]);
  const email = settings.contact.email || site.contact.email;
  const email2 = settings.contact.email2 || site.contact.email2;
  const phone = settings.contact.phone || site.contact.phone;
  const social = {
    linkedin:
      settings.social.linkedin && settings.social.linkedin !== "#" ? settings.social.linkedin : site.social.linkedin,
    youtube:
      settings.social.youtube && settings.social.youtube !== "#" ? settings.social.youtube : site.social.youtube,
    facebook:
      settings.social.facebook && settings.social.facebook !== "#" ? settings.social.facebook : site.social.facebook,
    amazon:
      settings.social.amazon && settings.social.amazon !== "#" ? settings.social.amazon : site.social.amazon,
  };
  const groups = nav?.footerGroups?.length ? nav.footerGroups : footerNav;
  const tagline = settings.company.tagline || site.tagline;
  const legalName = settings.company.legalName || site.legalName;
  const about =
    settings.company.description ||
    "Advanced materials, electrochemical systems and turnkey R&D — from lab-scale prototype to reliable industrial scale-up.";
  const office = site.addresses[0];
  const socialLinks = [
    { href: social.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
    { href: social.youtube, label: "YouTube", Icon: YouTubeIcon },
    { href: social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: social.amazon, label: "Amazon store", Icon: AmazonIcon },
  ];

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          {/* Left zone — branding + link columns; the HQ map fills the open
              area beneath them (bottom-aligned with the address column). */}
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-col gap-12 sm:flex-row sm:justify-between sm:gap-10">
              {/* --- Branding --- */}
              <div className="max-w-sm">
            <span className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-metnmat.png"
                alt={`${legalName} logo`}
                className="h-9 w-auto"
                width={183}
                height={54}
              />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground/90">{tagline}.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{about}</p>

            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <a href={`mailto:${email}`} className="flex items-center gap-2 transition-colors hover:text-brand">
                <Mail className="h-4 w-4 shrink-0 text-brand" /> {email}
              </a>
              {email2 && (
                <a
                  href={`mailto:${email2}`}
                  className="flex items-center gap-2 transition-colors hover:text-brand"
                >
                  <Mail className="h-4 w-4 shrink-0 text-brand" /> {email2}
                </a>
              )}
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 transition-colors hover:text-brand"
              >
                <Phone className="h-4 w-4 shrink-0 text-brand" /> {phone}
              </a>
            </div>

            <div className="mt-5 flex items-center gap-4">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href?.startsWith("http") ? "_blank" : undefined}
                  rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="transition-transform hover:scale-110"
                >
                  <Icon className="h-6 w-6" />
                </a>
              ))}
            </div>
          </div>

              {/* --- Link columns --- */}
              <div className="grid grid-cols-2 gap-8 sm:shrink-0 sm:gap-12">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="transition-colors hover:text-brand">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

              </div>
            </div>

            {/* HQ location — fills the open area under branding + links
                (Howrah pin only), bottom-aligned with the address column. */}
            {office && (
              <div className="mt-10 lg:mt-auto lg:pt-10">
                <iframe
                  title={`Map — ${legalName}, ${office.label}`}
                  src={office.mapEmbedUrl}
                  className="h-52 w-full rounded-2xl border border-border sm:h-60"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <a
                  href={office.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
                >
                  Open in Google Maps
                </a>
              </div>
            )}
          </div>

          {/* Get in touch — every office (HQ leads). */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Get in touch</h3>
            <div className="mt-4 space-y-3">
              {site.addresses.map((a) => (
                <p key={a.label} className="flex gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span>
                    <span className="font-medium text-foreground/90">{a.label}</span>
                    <br />
                    {a.lines.join(" ")}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </Container>

      {/* --- Bottom bar --- */}
      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-4">
            {bottomLinks.map((link) => (
              <li key={link.url}>
                <Link
                  href={link.url}
                  className="underline-offset-4 transition-colors hover:text-brand hover:underline"
                >
                  {link.text}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
