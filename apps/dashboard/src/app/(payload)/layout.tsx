import type { ServerFunctionClient } from "payload";
import config from "@payload-config";
import "@payloadcms/next/css";
import "./custom-admin.css";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import React from "react";
import { importMap } from "./admin/importMap.js";

type Args = { children: React.ReactNode };

/*
 * The same three faces the Command Center uses (Inter body, Space Grotesk for
 * headings and KPI numerals, JetBrains Mono for codes), self-hosted by next/font
 * so the admin makes no request to Google at runtime. They are exposed as CSS
 * variables on <html> — RootLayout owns that element, and htmlProps is the
 * supported way in — so custom-admin.css can reach them from every surface,
 * including drawers and modals that portal to <body>.
 */
const sans = Inter({ subsets: ["latin"], variable: "--font-mn-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-mn-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mn-mono", display: "swap" });

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    importMap={importMap}
    serverFunction={serverFunction}
    htmlProps={{ className: `${sans.variable} ${display.variable} ${mono.variable}` }}
  >
    {children}
  </RootLayout>
);

export default Layout;
