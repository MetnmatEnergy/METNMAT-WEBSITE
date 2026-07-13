import React from "react";
import type { Payload } from "payload";
import {
  BRAND,
  SUCCESS,
  INFO,
  ACCENT,
  MUTED,
  panel,
  inrCompact,
  inr,
  timeAgo,
  LineArea,
  Donut,
  HBars,
  Heatmap,
  Funnel,
  EmptyHint,
} from "../charts";
import type { ResolvedRange } from "./range";
import { delta } from "./range";
import {
  rollupsFor,
  sumRollups,
  seriesFrom,
  sessionStats,
  sessionsBy,
  pagesBy,
  topPages,
  topEntities,
  topCtas,
  topSearches,
  outboundTargets,
  formFunnel,
  viewsHeatmap,
  pageDetail,
  realtimeSnapshot,
  recentEvents,
  firstEventDay,
  rangeToWindow,
  geoProviderStatus,
} from "./queries";
import { KpiCard, Panel, RangeBar, DataNotice, href } from "./ui";
import { AutoRefresh } from "./AutoRefresh";
import { WorldLiveMap, type LiveCountry } from "./world-map";

/**
 * The nine analytics sections. Every number is real: rollups/sessions/raw
 * events for website behaviour, the Orders/Enquiries collections for business
 * outcomes. Anything without a legitimate source renders an explicit
 * integration/empty state instead of an invented value.
 */

type Ctx = { payload: Payload; range: ResolvedRange; searchParams: Record<string, string | undefined> };

const grid2: React.CSSProperties = { display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" };
const kpiGrid: React.CSSProperties = { display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" };

const fmtDur = (sec: number) => {
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ── Highlights ────────────────────────────────────────────────────────────────

export async function Highlights({ payload, range }: Ctx) {
  const [rows, prevRows, stats, pages, firstDay] = await Promise.all([
    rollupsFor(payload, range.days),
    rollupsFor(payload, range.compareDays),
    sessionStats(payload, range.days),
    topPages(payload, range.days, 8),
    firstEventDay(payload),
  ]);
  const cur = sumRollups(rows);
  const prev = sumRollups(prevRows);

  // Business outcomes for the same window — real Orders/Enquiries records.
  const { from, to } = rangeToWindow(range);
  const [ordersRes, enquiriesRes] = await Promise.all([
    payload
      .find({
        collection: "orders" as never,
        where: { and: [{ createdAt: { greater_than_equal: from.toISOString() } }, { createdAt: { less_than_equal: to.toISOString() } }] } as never,
        limit: 1000,
        depth: 0,
      })
      .catch(() => ({ docs: [] as unknown[] })),
    payload
      .count({
        collection: "enquiries" as never,
        where: { and: [{ createdAt: { greater_than_equal: from.toISOString() } }, { createdAt: { less_than_equal: to.toISOString() } }] } as never,
      })
      .catch(() => ({ totalDocs: 0 })),
  ]);
  const orders = ordersRes.docs as { status?: string; total?: number }[];
  const paid = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status || ""));
  const revenue = paid.reduce((n, o) => n + (o.total || 0), 0);

  const sources = Object.entries(cur.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([key, sessions]) => ({ label: key, value: sessions, display: String(sessions) }));
  const devices = Object.entries(cur.byDevice)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: [BRAND, INFO, ACCENT, MUTED][i % 4] }));

  return (
    <>
      <div style={kpiGrid}>
        <KpiCard label="Site sessions" value={String(cur.sessions)} current={cur.sessions} previous={prev.sessions} compare={range.compare} series={seriesFrom(rows, range.days, (r) => r.sessions ?? 0)} color={SUCCESS} sub={`${stats.visitors} unique visitors`} />
        <KpiCard label="Page views" value={String(cur.pageViews)} current={cur.pageViews} previous={prev.pageViews} compare={range.compare} series={seriesFrom(rows, range.days, (r) => r.pageViews ?? 0)} color={INFO} sub={stats.sessions > 0 ? `${(stats.totalPageViews / stats.sessions).toFixed(1)} pages / session` : undefined} />
        <KpiCard label="Form submissions" value={String(cur.formSubmits)} current={cur.formSubmits} previous={prev.formSubmits} compare={range.compare} series={seriesFrom(rows, range.days, (r) => r.formSubmits ?? 0)} color={ACCENT} sub="quote · contact · support" />
        <KpiCard label="Enquiries (RFQ)" value={String(enquiriesRes.totalDocs)} current={enquiriesRes.totalDocs} previous={0} compare="none" sub="business records, full history" />
        <KpiCard label="Orders" value={String(orders.length)} current={orders.length} previous={0} compare="none" sub={`${paid.length} paid`} />
        <KpiCard label="Revenue" value={inrCompact(revenue)} current={revenue} previous={0} compare="none" sub="paid orders in range (Orders collection)" />
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
        <Panel title="Sessions & page views">
          {cur.sessions > 0 || cur.pageViews > 0 ? (
            <LineArea months={range.days.map((d) => d.slice(5))} a={seriesFrom(rows, range.days, (r) => r.pageViews ?? 0)} b={seriesFrom(rows, range.days, (r) => r.sessions ?? 0)} colorA={INFO} colorB={SUCCESS} ariaLabel="Page views and sessions per day" />
          ) : (
            <EmptyHint text="No traffic recorded in this range yet." />
          )}
        </Panel>
        <Panel title="Traffic sources" action={<a href={href("traffic", range)} style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>Traffic report →</a>}>
          {sources.length > 0 ? <HBars rows={sources} color={BRAND} valueLabel="sessions" /> : <EmptyHint text="Sources appear once sessions arrive." />}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Most visited pages" action={<a href={href("behavior", range)} style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>Behavior →</a>}>
          {pages.length > 0 ? (
            <HBars rows={pages.map((p) => ({ label: p.path, value: p.views, display: `${p.views}` }))} color={INFO} valueLabel="views" />
          ) : (
            <EmptyHint text="Page views will rank here." />
          )}
        </Panel>
        <Panel title="Devices">
          {devices.length > 0 ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <Donut segments={devices} centerLabel="sessions" />
              <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 120 }}>
                {devices.map((s) => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ textTransform: "capitalize" }}>{s.label}</span>
                    <strong>{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyHint text="Device mix appears once sessions arrive." />
          )}
        </Panel>
        <Panel title="Engagement">
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            {[
              ["Avg pages / session", stats.sessions > 0 ? (stats.totalPageViews / stats.sessions).toFixed(1) : "—"],
              ["Avg session duration", stats.sessions > 0 ? fmtDur(stats.totalDurationSec / stats.sessions) : "—"],
              ["Bounce rate", stats.sessions > 0 ? `${((stats.bounces / stats.sessions) * 100).toFixed(1)}%` : "—"],
              ["Enquiry conversion", stats.sessions > 0 ? `${((stats.enquiryConversions / stats.sessions) * 100).toFixed(1)}%` : "—"],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>{k}</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{v}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <DataNotice firstDay={firstDay} />
    </>
  );
}

// ── Real-time ─────────────────────────────────────────────────────────────────

export async function Realtime({ payload }: Ctx) {
  const [active, recent, geoStatus] = await Promise.all([
    realtimeSnapshot(payload, 5),
    recentEvents(payload, 20),
    geoProviderStatus(),
  ]);

  // Aggregate active visitors per resolved country for the live map (the map
  // component handles centroid lookup; unknown-but-named countries still get
  // listed in its legend).
  const byCountry = new Map<string, number>();
  let unlocated = 0;
  for (const s of active) {
    if (s.country) byCountry.set(s.country, (byCountry.get(s.country) ?? 0) + 1);
    else unlocated += 1;
  }
  const liveCountries: LiveCountry[] = [...byCountry.entries()].map(([country, count]) => ({ country, count }));
  const verb = (e: { type: string; path: string; entityType?: string; entitySlug?: string; meta?: Record<string, unknown> }) => {
    switch (e.type) {
      case "page_view":
        return e.entityType ? `viewed ${e.entityType} “${e.entitySlug}”` : `opened ${e.path}`;
      case "form_submit":
        return `submitted the ${String(e.meta?.form ?? "")} form`;
      case "form_start":
        return `started the ${String(e.meta?.form ?? "")} form`;
      case "search":
        return `searched “${String(e.meta?.q ?? "")}”`;
      case "cta_click":
        return `clicked “${String(e.meta?.label ?? "")}”`;
      case "outbound_click":
        return `left to ${String(e.meta?.to ?? "")}`;
      case "purchase":
        return `placed order ${String(e.meta?.order ?? "")}`;
      default:
        return `${e.type} on ${e.path}`;
    }
  };
  return (
    <>
      <AutoRefresh seconds={12} />
      <div style={{ marginTop: 14 }}>
        <Panel title="Live visitor map" action={<span style={{ fontSize: 11.5, opacity: 0.5 }}>last 5 min · refreshes every 12s</span>}>
          <WorldLiveMap countries={liveCountries} unlocated={unlocated} configured={geoStatus !== "disabled"} />
        </Panel>
      </div>
      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)" }}>
        <Panel title={`Active now (${active.length})`} action={<span style={{ fontSize: 11.5, opacity: 0.5 }}>last 5 min · refreshes every 12s</span>}>
          {active.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {active.map((s) => (
                <div key={s.sid} style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 8, fontSize: 12.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: SUCCESS, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.lastPath}</div>
                    <div style={{ opacity: 0.55, fontSize: 11.5 }}>
                      {[s.source, s.channel, s.device, s.country].filter(Boolean).join(" · ") || "session context pending"}
                    </div>
                  </div>
                  <span style={{ opacity: 0.5, fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(String(s.lastTs))}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint text="Nobody is on the site right now." />
          )}
        </Panel>
        <Panel title="Live activity">
          {recent.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {recent.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: e.type === "purchase" ? SUCCESS : e.type.startsWith("form") ? ACCENT : INFO, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Visitor {verb(e)}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(String(e.ts))}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint text="Events stream in here as visitors browse." />
          )}
        </Panel>
      </div>
    </>
  );
}

// ── Traffic ───────────────────────────────────────────────────────────────────

export async function Traffic({ payload, range }: Ctx) {
  const [rows, stats, prevStats, bySource, byChannel, aiChannels, byCountry, byBrowser, byOs, landing, exits, geoStatus] = await Promise.all([
    rollupsFor(payload, range.days),
    sessionStats(payload, range.days),
    sessionStats(payload, range.compareDays),
    sessionsBy(payload, range.days, "source", 10),
    sessionsBy(payload, range.days, "channel", 12),
    sessionsBy(payload, range.days, "channel", 8, { source: "ai" }),
    sessionsBy(payload, range.days, "country", 12),
    sessionsBy(payload, range.days, "browser", 8),
    sessionsBy(payload, range.days, "os", 8),
    pagesBy(payload, range.days, "entryPath", 10),
    pagesBy(payload, range.days, "exitPath", 10),
    geoProviderStatus(),
  ]);
  const cur = sumRollups(rows);
  const newVisitors = Math.max(0, stats.visitors - stats.returningVisitors);

  return (
    <>
      <div style={kpiGrid}>
        <KpiCard label="Sessions" value={String(stats.sessions)} current={stats.sessions} previous={prevStats.sessions} compare={range.compare} color={SUCCESS} />
        <KpiCard label="Visitors" value={String(stats.visitors)} current={stats.visitors} previous={prevStats.visitors} compare={range.compare} color={INFO} sub={`${newVisitors} new · ${stats.returningVisitors} returning`} />
        <KpiCard label="Page views" value={String(cur.pageViews)} current={cur.pageViews} previous={0} compare="none" />
        <KpiCard label="Pages / session" value={stats.sessions > 0 ? (stats.totalPageViews / stats.sessions).toFixed(1) : "—"} current={stats.totalPageViews} previous={prevStats.totalPageViews} compare={range.compare} />
      </div>

      <div style={grid2}>
        <Panel title="Acquisition (sessions · enquiries · orders)">
          {bySource.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 4px" }}>Source</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Sessions</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Enquiries</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Orders</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((s) => (
                  <tr key={s.key} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                    <td style={{ padding: "8px 4px", fontWeight: 600, textTransform: "capitalize" }}>{s.key}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.sessions}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.enquiries ?? 0}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.purchases ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyHint text="Acquisition appears once sessions arrive." />
          )}
        </Panel>
        <Panel title="Channels (search engines, socials, referrers)">
          {byChannel.filter((c) => c.key).length > 0 ? (
            <HBars rows={byChannel.filter((c) => c.key).map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={INFO} valueLabel="sessions" />
          ) : (
            <EmptyHint text="Referring channels will rank here." />
          )}
        </Panel>
        <Panel title="AI platform referrals">
          {aiChannels.length > 0 ? (
            <HBars rows={aiChannels.map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={ACCENT} valueLabel="sessions" />
          ) : (
            <EmptyHint text="Sessions arriving from ChatGPT, Gemini, Perplexity, Copilot or Claude (by referrer evidence) appear here. None in this range." />
          )}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Geography (sessions by country)">
          {byCountry.length > 0 ? (
            <HBars rows={byCountry.map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={BRAND} valueLabel="sessions" />
          ) : geoStatus === "configured" ? (
            <div style={{ fontSize: 13, opacity: 0.65, padding: "18px 4px", lineHeight: 1.6 }}>
              <strong>IPinfo Lite is connected.</strong>
              <br />
              Country data will appear as visitors generate activity. Existing active sessions are enriched on their next event.
            </div>
          ) : geoStatus === "unknown" ? (
            <div style={{ fontSize: 13, opacity: 0.65, padding: "18px 4px", lineHeight: 1.6 }}>
              <strong>No country data in this range yet.</strong>
              <br />
              The dashboard could not verify the website&apos;s geo-provider status. Check website health and recent ingestion.
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.65, padding: "18px 4px", lineHeight: 1.6 }}>
              <strong>Geography is not configured.</strong>
              <br />
              Set <code>ANALYTICS_GEO_TOKEN</code> (ipinfo.io token) on the website service to resolve coarse
              country at ingestion. IPs are used transiently and never stored.
            </div>
          )}
        </Panel>
        <Panel title="Browsers">
          {byBrowser.length > 0 ? <HBars rows={byBrowser.map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={INFO} valueLabel="sessions" /> : <EmptyHint text="No sessions yet." />}
        </Panel>
        <Panel title="Operating systems">
          {byOs.length > 0 ? <HBars rows={byOs.map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={MUTED} valueLabel="sessions" /> : <EmptyHint text="No sessions yet." />}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Top landing pages">
          {landing.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 4px" }}>Page</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Sessions</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Bounce</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Enquiries</th>
                </tr>
              </thead>
              <tbody>
                {landing.map((p) => (
                  <tr key={p.path} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                    <td style={{ padding: "8px 4px", fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.sessions}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.sessions > 0 ? `${Math.round((p.bounces / p.sessions) * 100)}%` : "—"}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.enquiries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyHint text="Landing pages will rank here." />
          )}
        </Panel>
        <Panel title="Top exit pages">
          {exits.length > 0 ? (
            <HBars rows={exits.map((p) => ({ label: p.path, value: p.sessions, display: String(p.sessions) }))} color={MUTED} valueLabel="exits" />
          ) : (
            <EmptyHint text="Exit pages will rank here." />
          )}
        </Panel>
      </div>
    </>
  );
}

// ── Behavior ──────────────────────────────────────────────────────────────────

export async function Behavior({ payload, range, searchParams }: Ctx) {
  const focusPath = typeof searchParams.path === "string" && searchParams.path.startsWith("/") ? searchParams.path : null;
  const [pages, products, projects, blogs, ctas, outbound, searches, funnel, heat, detail] = await Promise.all([
    topPages(payload, range.days, 12),
    topEntities(payload, range.days, "product", 8),
    topEntities(payload, range.days, "project", 8),
    topEntities(payload, range.days, "blog", 8),
    topCtas(payload, range.days, 10),
    outboundTargets(payload, range.days, 8),
    topSearches(payload, range.days, 10),
    formFunnel(payload, range.days),
    viewsHeatmap(payload, range.days),
    focusPath ? pageDetail(payload, range.days, focusPath) : Promise.resolve(null),
  ]);

  return (
    <>
      {detail && (
        <div style={{ ...panel, marginTop: 14, borderColor: BRAND }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Page drill-down · {detail.path}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 13 }}>
            <span><strong>{detail.views}</strong> views</span>
            <span><strong>{detail.visitors}</strong> unique visitors</span>
            <span><strong>{fmtDur(detail.avgDwellSec)}</strong> avg time on page</span>
            <span><strong>{detail.avgScrollPct}%</strong> avg scroll depth</span>
          </div>
        </div>
      )}
      <div style={grid2}>
        <Panel title="Most visited pages">
          {pages.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {pages.map((p) => (
                <a key={p.path} href={href("behavior", range, { path: p.path })} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, textDecoration: "none", color: "var(--theme-text)", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</span>
                  <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {p.views} <span style={{ opacity: 0.5 }}>views · {p.visitors} visitors</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyHint text="Pages will rank here once views arrive." />
          )}
        </Panel>
        <Panel title="Forms (starts → submissions)">
          {funnel.length > 0 ? (
            <div style={{ display: "grid", gap: 16 }}>
              {funnel.map((f) => (
                <div key={f.form}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize", marginBottom: 6 }}>{f.form}</div>
                  <Funnel stages={[{ label: "Started", value: f.starts }, { label: "Submitted", value: f.submits }]} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint text="Form starts and submissions chart here." />
          )}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Most viewed products">
          {products.length > 0 ? <HBars rows={products.map((p) => ({ label: p.slug, value: p.views, display: String(p.views) }))} color={BRAND} valueLabel="views" /> : <EmptyHint text="Product-page views rank here." />}
        </Panel>
        <Panel title="Most viewed projects">
          {projects.length > 0 ? <HBars rows={projects.map((p) => ({ label: p.slug, value: p.views, display: String(p.views) }))} color={INFO} valueLabel="views" /> : <EmptyHint text="Project-page views rank here." />}
        </Panel>
        <Panel title="Most read blog articles">
          {blogs.length > 0 ? <HBars rows={blogs.map((p) => ({ label: p.slug, value: p.views, display: String(p.views) }))} color={ACCENT} valueLabel="views" /> : <EmptyHint text="Blog views (time-series) rank here; lifetime totals stay on each post." />}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Most clicked CTAs">
          {ctas.length > 0 ? (
            <HBars rows={ctas.map((c) => ({ label: c.label, value: c.clicks, display: String(c.clicks) }))} color={SUCCESS} valueLabel="clicks" />
          ) : (
            <EmptyHint text='Buttons tagged data-track="…" on the website rank here.' />
          )}
        </Panel>
        <Panel title="Internal searches">
          {searches.length > 0 ? <HBars rows={searches.map((s) => ({ label: s.q, value: s.n, display: String(s.n) }))} color={INFO} valueLabel="searches" /> : <EmptyHint text="Site-search terms appear here." />}
        </Panel>
        <Panel title="Outbound clicks">
          {outbound.length > 0 ? <HBars rows={outbound.map((o) => ({ label: o.host, value: o.n, display: String(o.n) }))} color={MUTED} valueLabel="clicks" /> : <EmptyHint text="External destinations visitors leave to." />}
        </Panel>
      </div>

      <div style={{ marginTop: 14 }}>
        <Panel title="Views by time of day (IST)">
          <Heatmap grid={heat} />
        </Panel>
      </div>
    </>
  );
}

// ── Marketing ─────────────────────────────────────────────────────────────────

export async function Marketing({ payload, range }: Ctx) {
  const [campaigns, sources, mediums, ai] = await Promise.all([
    sessionsBy(payload, range.days, "utmCampaign", 12, { utmCampaign: { $ne: "" } }),
    sessionsBy(payload, range.days, "utmSource", 12, { utmSource: { $ne: "" } }),
    sessionsBy(payload, range.days, "utmMedium", 12, { utmMedium: { $ne: "" } }),
    sessionsBy(payload, range.days, "channel", 8, { source: "ai" }),
  ]);

  const campaignTable = (rows: typeof campaigns, title: string) => (
    <Panel title={title}>
      {rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "6px 4px" }}>Value</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Sessions</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Enquiries</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Orders</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                <td style={{ padding: "8px 4px", fontWeight: 600 }}>{c.key}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.sessions}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.enquiries ?? 0}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.purchases ?? 0}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.revenue ? inr(c.revenue) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyHint text="Tag links with UTM parameters (utm_source / utm_medium / utm_campaign) and results attribute here." />
      )}
    </Panel>
  );

  return (
    <>
      <div style={{ marginTop: 14 }}>{campaignTable(campaigns, "Campaign performance (utm_campaign)")}</div>
      <div style={grid2}>
        {campaignTable(sources, "Source performance (utm_source)")}
        {campaignTable(mediums, "Medium performance (utm_medium)")}
      </div>
      <div style={grid2}>
        <Panel title="AI platform traffic">
          {ai.length > 0 ? (
            <HBars rows={ai.map((c) => ({ label: c.key, value: c.sessions, display: String(c.sessions) }))} color={ACCENT} valueLabel="sessions" />
          ) : (
            <EmptyHint text="Referrer-evidenced sessions from AI platforms appear here." />
          )}
        </Panel>
        <Panel title="Google Search Console">
          <div style={{ fontSize: 13, opacity: 0.7, padding: "16px 4px", lineHeight: 1.7 }}>
            <strong>Not connected.</strong>
            <br />
            Search impressions, clicks, queries and average position require the Google Search Console API — they
            cannot be derived from on-site analytics. Connecting needs a Google Cloud service account with Search
            Console access for www.metnmat.com; once credentials exist this panel becomes a real report.
          </div>
        </Panel>
      </div>
    </>
  );
}

// ── Session Recordings ────────────────────────────────────────────────────────

export function Recordings() {
  return (
    <div style={{ ...panel, marginTop: 14, maxWidth: 720 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Session recordings are not enabled</div>
      <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.7 }}>
        <p style={{ margin: 0 }}>
          Recording visitor sessions (DOM replay) is deliberately <strong>off</strong>. Enabling it is a privacy and
          cost decision, not just a feature toggle:
        </p>
        <ul style={{ margin: "10px 0 0 18px", padding: 0 }}>
          <li>Consent: replay goes beyond the “basic usage analytics” the privacy policy currently discloses — it would need explicit consent UX.</li>
          <li>Masking: passwords, OTPs, payment fields, emails, phone numbers and message content must be masked at capture time, never after.</li>
          <li>Storage: replay payloads are orders of magnitude larger than events — MongoDB is the wrong store; GCS with a strict retention window would be required.</li>
          <li>Retention & access: recordings need their own retention clock and admin-only, audited access.</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          If recordings become a requirement, the recommendation is a masked, consent-gated, first-party rrweb pipeline
          into GCS with 30-day retention — scoped and reviewed as its own project.
        </p>
      </div>
    </div>
  );
}

// ── Insights (rule-based; labelled honestly) ─────────────────────────────────

export async function Insights({ payload, range }: Ctx) {
  const [rows, prevRows, stats, prevStats, pages, bySource] = await Promise.all([
    rollupsFor(payload, range.days),
    rollupsFor(payload, range.compareDays),
    sessionStats(payload, range.days),
    sessionStats(payload, range.compareDays),
    pagesBy(payload, range.days, "entryPath", 20),
    sessionsBy(payload, range.days, "source", 10),
  ]);
  const cur = sumRollups(rows);
  const prev = sumRollups(prevRows);

  const insights: { text: string; tone: "up" | "down" | "flat" }[] = [];
  const add = (text: string, tone: "up" | "down" | "flat" = "flat") => insights.push({ text, tone });

  if (range.compare !== "none" && prev.sessions > 0) {
    const d = delta(cur.sessions, prev.sessions);
    if (Math.abs(d.abs) >= Math.max(3, prev.sessions * 0.1)) {
      add(`Traffic ${d.abs > 0 ? "increased" : "decreased"} ${d.text.replace("+", "")} vs the comparison period (${cur.sessions} vs ${prev.sessions} sessions).`, d.abs > 0 ? "up" : "down");
    }
  }
  if (stats.sessions >= 10 && prevStats.sessions >= 10) {
    const br = stats.bounces / stats.sessions;
    const pbr = prevStats.bounces / prevStats.sessions;
    if (Math.abs(br - pbr) >= 0.08) {
      add(`Bounce rate moved from ${(pbr * 100).toFixed(0)}% to ${(br * 100).toFixed(0)}%.`, br < pbr ? "up" : "down");
    }
  }
  const bestSource = [...bySource].sort((a, b) => (b.enquiries ?? 0) - (a.enquiries ?? 0))[0];
  if (bestSource && (bestSource.enquiries ?? 0) > 0) {
    add(`“${bestSource.key}” traffic generated the most enquiries in this range (${bestSource.enquiries}).`, "up");
  }
  const ai = bySource.find((s) => s.key === "ai");
  if (ai && ai.sessions > 0) add(`${ai.sessions} session${ai.sessions === 1 ? "" : "s"} arrived from AI platforms (referrer or UTM evidence).`, "up");
  const highTrafficNoConv = pages.filter((p) => p.sessions >= 5 && p.enquiries === 0).slice(0, 3);
  for (const p of highTrafficNoConv) {
    add(`“${p.path}” lands ${p.sessions} sessions but produced no enquiries — worth reviewing its CTA.`, "down");
  }
  if (cur.formStarts > 0 && cur.formSubmits < cur.formStarts * 0.5) {
    add(`Form abandonment is high: ${cur.formStarts} starts → ${cur.formSubmits} submissions.`, "down");
  }
  if (cur.searches > 0) add(`${cur.searches} internal searches — the Behavior tab lists the exact terms.`, "flat");

  return (
    <div style={{ ...panel, marginTop: 14, maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Automated insights</div>
        <span style={{ fontSize: 11.5, opacity: 0.5 }}>deterministic rules over your data — not AI-generated</span>
      </div>
      {insights.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {insights.map((i, n) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 10 }}>
              <span style={{ color: i.tone === "up" ? SUCCESS : i.tone === "down" ? BRAND : MUTED, fontWeight: 800 }}>
                {i.tone === "up" ? "▲" : i.tone === "down" ? "▼" : "—"}
              </span>
              <span>{i.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint text="Insights appear once there is enough data in the selected range to say something meaningful." />
      )}
    </div>
  );
}

// ── Benchmarks (internal historical) ─────────────────────────────────────────

export async function Benchmarks({ payload }: Ctx) {
  const now = Date.now();
  const DAY = 86_400_000;
  const windows: { label: string; days: string[]; prevDays: string[] }[] = [];
  const mk = (label: string, curFrom: number, curTo: number, prevFrom: number, prevTo: number) => {
    const build = (a: number, b: number) => {
      const out: string[] = [];
      for (let t = a; t <= b; t += DAY) out.push(new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10));
      return out;
    };
    windows.push({ label, days: build(curFrom, curTo), prevDays: build(prevFrom, prevTo) });
  };
  mk("Last 30 days vs previous 30", now - 29 * DAY, now, now - 59 * DAY, now - 30 * DAY);
  mk("Last 90 days vs previous 90", now - 89 * DAY, now, now - 179 * DAY, now - 90 * DAY);
  mk("Last 12 months vs previous 12", now - 364 * DAY, now, now - 729 * DAY, now - 365 * DAY);

  const rows = await Promise.all(
    windows.map(async (w) => {
      const [cur, prev] = await Promise.all([rollupsFor(payload, w.days), rollupsFor(payload, w.prevDays)]);
      return { label: w.label, cur: sumRollups(cur), prev: sumRollups(prev) };
    })
  );

  const metrics: { label: string; pick: (t: ReturnType<typeof sumRollups>) => number; fmt?: (n: number) => string }[] = [
    { label: "Sessions", pick: (t) => t.sessions },
    { label: "Page views", pick: (t) => t.pageViews },
    { label: "Form submissions", pick: (t) => t.formSubmits },
    { label: "Purchases (events)", pick: (t) => t.purchases },
    { label: "Purchase value", pick: (t) => t.purchaseTotal, fmt: inrCompact },
  ];

  return (
    <div style={{ ...panel, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>Internal historical benchmarks</div>
        <span style={{ fontSize: 11.5, opacity: 0.5 }}>your own history — no invented industry numbers</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "6px 4px" }}>Window</th>
              {metrics.map((m) => (
                <th key={m.label} style={{ padding: "6px 4px", textAlign: "right" }}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                <td style={{ padding: "9px 4px", fontWeight: 600 }}>{r.label}</td>
                {metrics.map((m) => {
                  const c = m.pick(r.cur);
                  const p = m.pick(r.prev);
                  const d = delta(c, p);
                  return (
                    <td key={m.label} style={{ padding: "9px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <strong>{m.fmt ? m.fmt(c) : c.toLocaleString("en-IN")}</strong>{" "}
                      <span style={{ fontSize: 11, color: d.up ? SUCCESS : BRAND }}>{d.text}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── All Reports ───────────────────────────────────────────────────────────────

export function Reports({ range }: Ctx) {
  const groups: { title: string; items: { label: string; href: string }[] }[] = [
    {
      title: "Traffic",
      items: [
        { label: "Traffic overview", href: href("traffic", range) },
        { label: "Sources & channels", href: href("traffic", range) },
        { label: "AI referral traffic", href: href("traffic", range) },
        { label: "Geography", href: href("traffic", range) },
        { label: "Landing & exit pages", href: href("traffic", range) },
      ],
    },
    {
      title: "Behavior",
      items: [
        { label: "Pages & drill-down", href: href("behavior", range) },
        { label: "Products / projects / blog", href: href("behavior", range) },
        { label: "CTAs & outbound clicks", href: href("behavior", range) },
        { label: "Forms funnel", href: href("behavior", range) },
        { label: "Internal search terms", href: href("behavior", range) },
      ],
    },
    {
      title: "Marketing",
      items: [
        { label: "UTM campaigns", href: href("marketing", range) },
        { label: "Search Console (connect)", href: href("marketing", range) },
      ],
    },
    {
      title: "Commerce & Conversions",
      items: [
        { label: "Business analytics (orders, revenue, RFQs)", href: "/admin/analytics" },
        { label: "Orders", href: "/admin/collections/orders" },
        { label: "Enquiries (RFQ)", href: "/admin/collections/enquiries" },
        { label: "Quotations", href: "/admin/collections/quotations" },
      ],
    },
  ];
  const from = range.days[0];
  const to = range.days[range.days.length - 1];
  const exports = [
    { label: "Daily rollups (CSV)", href: `/api/analytics-daily/export?type=daily&from=${from}&to=${to}` },
    { label: "Sessions (CSV)", href: `/api/analytics-daily/export?type=sessions&from=${from}&to=${to}` },
    { label: "Top pages (CSV)", href: `/api/analytics-daily/export?type=pages&from=${from}&to=${to}` },
    { label: "Search terms (CSV)", href: `/api/analytics-daily/export?type=searches&from=${from}&to=${to}` },
  ];
  return (
    <>
      <div style={grid2}>
        {groups.map((g) => (
          <Panel key={g.title} title={g.title}>
            <div style={{ display: "grid", gap: 8 }}>
              {g.items.map((i) => (
                <a key={i.label} href={i.href} style={{ fontSize: 13, color: "var(--theme-text)", textDecoration: "none", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                  {i.label} <span style={{ color: BRAND }}>→</span>
                </a>
              ))}
            </div>
          </Panel>
        ))}
        <Panel title="CSV exports (current range)">
          <div style={{ display: "grid", gap: 8 }}>
            {exports.map((e) => (
              <a key={e.label} href={e.href} style={{ fontSize: 13, color: "var(--theme-text)", textDecoration: "none", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                ⬇ {e.label}
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

export { RangeBar };
