import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { site } from "@/frontend/lib/site";
import { getSettings, getUsdRate } from "@/frontend/lib/cms";
import { CurrencyProvider } from "@/frontend/components/commerce/currency-provider";
import { SiteHeader } from "@/frontend/components/layout/site-header";
import { SiteFooter } from "@/frontend/components/layout/site-footer";
import { TopBar } from "@/frontend/components/layout/top-bar";
import { StoreProvider } from "@/frontend/components/commerce/store-provider";
import { QuoteProvider } from "@/frontend/components/commerce/quote-provider";
import { QuoteDrawer } from "@/frontend/components/commerce/quote-drawer";
import { QuoteModal } from "@/frontend/components/commerce/quote-modal";
import { ChatWidget } from "@/frontend/components/chat/chat-widget";
import { ChatCartBridge } from "@/frontend/components/commerce/chat-cart-bridge";
import { CartRail } from "@/frontend/components/commerce/cart-rail";
import { CartToast } from "@/frontend/components/commerce/cart-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // SEO defaults come from the CMS `seo`/`company` globals, falling back to site.ts.
  const s = await getSettings();
  const defaultTitle = s.seo.defaultTitle || `${site.legalName} — ${site.tagline}`;
  const template = s.seo.titleTemplate || `%s · ${site.name}`;
  const description = s.seo.description || site.description;
  const siteName = s.company.legalName || site.legalName;
  return {
    metadataBase: new URL(site.url),
    title: { default: defaultTitle, template },
    description,
    keywords: [
      "metallurgy R&D",
      "materials science R&D",
      "materials research India",
      "metallurgy company India",
      "electrochemistry equipment",
      "reference electrodes",
      "ion-exchange membranes",
      "electrochemical cells",
      "heat treatment",
      "copper alloys",
      "oxygen-free copper",
      "turnkey R&D solutions",
      "Howrah West Bengal",
    ],
    openGraph: {
      type: "website",
      siteName,
      title: defaultTitle,
      description,
      url: site.url,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: site.name },
    icons: {
      icon: "/logo-metnmat-transparent.png",
      shortcut: "/logo-metnmat-transparent.png",
      apple: "/logo-metnmat-transparent.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

// Apply persisted theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('mm-theme');var d=document.documentElement;if(t==='light'){d.classList.add('light');d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // ₹-per-$ display rate, maintained by staff in the dashboard.
  const usdRate = await getUsdRate();
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-brand px-4 py-2 font-medium text-brand-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <CurrencyProvider usdRate={usdRate}>
        <StoreProvider>
        <QuoteProvider>
        <div className="flex min-h-dvh flex-col">
          <TopBar />
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        <QuoteDrawer />
        <QuoteModal />
        <CartRail />
        <CartToast />
        <ChatWidget />
        <ChatCartBridge />
        </QuoteProvider>
        </StoreProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
