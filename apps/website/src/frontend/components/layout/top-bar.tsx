import { Mail, Phone } from "lucide-react";
import { AmazonIcon, FacebookIcon, LinkedInIcon, YouTubeIcon } from "@/frontend/components/ui/brand-icons";
import { Container } from "@/frontend/components/ui/container";
import { site } from "@/frontend/lib/site";
import { getSettings } from "@/frontend/lib/cms";

/** Thin utility strip above the header: contact left, shipping + socials right. */
export async function TopBar() {
  const settings = await getSettings();
  const email = settings.contact.email || site.contact.email;
  const phone = settings.contact.phone || site.contact.phone;
  const social = {
    linkedin: settings.social.linkedin && settings.social.linkedin !== "#" ? settings.social.linkedin : site.social.linkedin,
    youtube: settings.social.youtube && settings.social.youtube !== "#" ? settings.social.youtube : site.social.youtube,
    facebook: settings.social.facebook && settings.social.facebook !== "#" ? settings.social.facebook : site.social.facebook,
    amazon: settings.social.amazon && settings.social.amazon !== "#" ? settings.social.amazon : site.social.amazon,
  };
  return (
    <div className="hidden border-b border-border bg-background/60 text-xs text-muted-foreground lg:block">
      <Container className="flex h-8 items-center justify-between">
        <div className="flex items-center gap-6">
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            {email}
          </a>
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            {phone}
          </a>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-3">
            <a
              href={social.linkedin}
              aria-label="LinkedIn"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              <LinkedInIcon className="h-4 w-4" />
            </a>
            <a
              href={social.youtube}
              aria-label="YouTube"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              <YouTubeIcon className="h-4 w-4" />
            </a>
            <a
              href={social.facebook}
              aria-label="Facebook"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href={social.amazon}
              aria-label="Amazon store"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              <AmazonIcon className="h-4 w-4" />
            </a>
          </span>
        </div>
      </Container>
    </div>
  );
}
