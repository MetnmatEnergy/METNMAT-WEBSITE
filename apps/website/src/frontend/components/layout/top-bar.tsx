import { Mail, Phone, Linkedin, Youtube, Facebook } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { site } from "@/frontend/lib/site";
import { getSettings } from "@/frontend/lib/cms";

/** Thin utility strip above the header: contact left, shipping + socials right. */
export async function TopBar() {
  const settings = await getSettings();
  const email = settings.contact.email || site.contact.email;
  const phone = settings.contact.phone || site.contact.phone;
  const shipping = settings.contact.shippingNote || site.contact.shipping;
  const social = {
    linkedin: settings.social.linkedin && settings.social.linkedin !== "#" ? settings.social.linkedin : site.social.linkedin,
    youtube: settings.social.youtube && settings.social.youtube !== "#" ? settings.social.youtube : site.social.youtube,
    facebook: settings.social.facebook && settings.social.facebook !== "#" ? settings.social.facebook : site.social.facebook,
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
          <span>{shipping}</span>
          <span className="flex items-center gap-3">
            <a href={social.linkedin} aria-label="LinkedIn" className="hover:text-foreground">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href={social.youtube} aria-label="YouTube" className="hover:text-foreground">
              <Youtube className="h-4 w-4" />
            </a>
            <a href={social.facebook} aria-label="Facebook" className="hover:text-foreground">
              <Facebook className="h-4 w-4" />
            </a>
          </span>
        </div>
      </Container>
    </div>
  );
}
