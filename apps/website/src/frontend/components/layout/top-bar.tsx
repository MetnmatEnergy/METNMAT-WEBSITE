import { Mail, Phone, Linkedin, Youtube, Facebook } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { site } from "@/frontend/lib/site";

/** Thin utility strip above the header: contact left, shipping + socials right. */
export function TopBar() {
  return (
    <div className="hidden border-b border-border bg-background/60 text-xs text-muted-foreground lg:block">
      <Container className="flex h-10 items-center justify-between">
        <div className="flex items-center gap-6">
          <a
            href={`mailto:${site.contact.email}`}
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            {site.contact.email}
          </a>
          <a
            href={`tel:${site.contact.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            {site.contact.phone}
          </a>
        </div>
        <div className="flex items-center gap-5">
          <span>{site.contact.shipping}</span>
          <span className="flex items-center gap-3">
            <a href={site.social.linkedin} aria-label="LinkedIn" className="hover:text-foreground">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href={site.social.youtube} aria-label="YouTube" className="hover:text-foreground">
              <Youtube className="h-4 w-4" />
            </a>
            <a href={site.social.facebook} aria-label="Facebook" className="hover:text-foreground">
              <Facebook className="h-4 w-4" />
            </a>
          </span>
        </div>
      </Container>
    </div>
  );
}
