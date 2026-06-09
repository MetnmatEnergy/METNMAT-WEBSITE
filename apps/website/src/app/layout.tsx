import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { site } from "@/frontend/lib/site";
import { SiteHeader } from "@/frontend/components/layout/site-header";
import { SiteFooter } from "@/frontend/components/layout/site-footer";
import { TopBar } from "@/frontend/components/layout/top-bar";
import { StoreProvider } from "@/frontend/components/commerce/store-provider";
import { QuoteProvider } from "@/frontend/components/commerce/quote-provider";
import { QuoteDrawer } from "@/frontend/components/commerce/quote-drawer";
import { QuoteModal } from "@/frontend/components/commerce/quote-modal";

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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.legalName} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.legalName,
    title: `${site.legalName} — ${site.tagline}`,
    description: site.description,
    url: site.url,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: site.name },
  icons: {
    icon: "/logo-metnmat-transparent.png",
    shortcut: "/logo-metnmat-transparent.png",
    apple: "/logo-metnmat-transparent.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

// Apply persisted theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('mm-theme');var d=document.documentElement;if(t==='light'){d.classList.add('light');d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        </QuoteProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
