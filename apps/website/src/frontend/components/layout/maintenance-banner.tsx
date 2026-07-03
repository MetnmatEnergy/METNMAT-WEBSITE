import Link from "next/link";
import { Mail, Phone, Wrench } from "lucide-react";
import { getMaintenance, getSettings } from "@/frontend/lib/cms";

/**
 * Site-wide maintenance notice, controlled by the CMS "Maintenance Notice"
 * global (Website Settings). Renders nothing when the switch is off — and
 * fail-safe off when the CMS is unreachable. The site remains fully usable;
 * this is an informational banner, not a shutdown page.
 */
export async function MaintenanceBanner() {
  const notice = await getMaintenance();
  if (!notice.enabled) return null;
  const settings = notice.showContact ? await getSettings() : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-[60] border-b border-amber-500/30 bg-amber-500/10 print:hidden"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-x-6 gap-y-1 px-4 py-2.5 text-center text-sm sm:flex-row sm:justify-center sm:text-left">
        <p className="flex items-start gap-2 font-medium text-amber-700 dark:text-amber-300 sm:items-center">
          <Wrench aria-hidden className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
          <span>{notice.message}</span>
        </p>
        {settings && (
          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-amber-700/90 dark:text-amber-300/90">
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span>
              Need help? Contact our{" "}
              <Link href="/contact" className="font-semibold underline underline-offset-4 hover:text-amber-600 dark:hover:text-amber-200">
                customer service
              </Link>
            </span>
            {settings.contact.email && (
              <a
                href={`mailto:${settings.contact.email}`}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-amber-600 dark:hover:text-amber-200"
              >
                <Mail aria-hidden className="h-3.5 w-3.5" />
                {settings.contact.email}
              </a>
            )}
            {settings.contact.phone && (
              <a
                href={`tel:${settings.contact.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-amber-600 dark:hover:text-amber-200"
              >
                <Phone aria-hidden className="h-3.5 w-3.5" />
                {settings.contact.phone}
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
