import React from "react";
import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import { resolveRange } from "./analytics/range";
import { RangeBar, SectionTabs, SECTIONS } from "./analytics/ui";
import {
  Highlights,
  Realtime,
  Traffic,
  Behavior,
  Marketing,
  Recordings,
  Insights,
  Benchmarks,
  Reports,
} from "./analytics/sections";
import { BusinessAnalytics } from "./analytics/business";

/**
 * /admin/analytics — the first-party website analytics suite (Highlights,
 * Real-time, Traffic, Behavior, Marketing, Session Recordings, Insights,
 * Benchmarks, All Reports + the original Business analytics). One prefix-
 * mounted view with internal sub-routing (params.segments), so the whole suite
 * is a single importMap entry.
 *
 * Auth: STAFF ONLY — checks user.collection === "users", because req.user can
 * also be a storefront customer (the customers auth collection has public
 * self-registration; a bare user check would admit shoppers).
 */
export default async function SiteAnalyticsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const user = initPageResult?.req?.user as { collection?: string } | null | undefined;
  if (!user) redirect("/admin/login");
  if (user.collection !== "users") redirect("/admin/unauthorized");

  const { payload } = initPageResult.req;

  const sp: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    sp[k] = Array.isArray(v) ? v[0] : (v as string | undefined);
  }
  const range = resolveRange({ range: sp.range, from: sp.from, to: sp.to, compare: sp.compare });

  // Sub-route: /admin/analytics/<section>. params.segments = ["analytics", …].
  const segments = (params?.segments ?? []) as string[];
  const section = segments[1] ?? "";
  const known = new Set([...SECTIONS.map((s) => s.slug), "business"]);
  const active = known.has(section) ? section : "";

  const ctx = { payload, range, searchParams: sp };
  const title = SECTIONS.find((s) => s.slug === active)?.label ?? (active === "business" ? "Business analytics" : "Highlights");

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div style={{ paddingBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Analytics · {title}</h1>
            <span style={{ fontSize: 12.5, opacity: 0.55 }}>First-party, privacy-light — every number from your own data</span>
          </div>

          <SectionTabs active={active} range={range} />
          {active !== "realtime" && active !== "recordings" && <RangeBar section={active} range={range} />}

          {active === "" && <Highlights {...ctx} />}
          {active === "realtime" && <Realtime {...ctx} />}
          {active === "traffic" && <Traffic {...ctx} />}
          {active === "behavior" && <Behavior {...ctx} />}
          {active === "marketing" && <Marketing {...ctx} />}
          {active === "recordings" && <Recordings />}
          {active === "insights" && <Insights {...ctx} />}
          {active === "benchmarks" && <Benchmarks {...ctx} />}
          {active === "reports" && <Reports {...ctx} />}
          {active === "business" && <BusinessAnalytics payload={payload} />}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
