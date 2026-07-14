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
import { delta, istDayOf } from "./range";
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
  sessionList,
  sessionTimeline,
  firstEventDay,
  rangeToWindow,
  geoProviderStatus,
  type SessionRow,
  type TimelineEvent,
} from "./queries";
import { KpiCard, Panel, RangeBar, DataNotice, SectionIntro, href } from "./ui";
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
  const [stats, prevStats, devices, browsers, oses, pages, products, projects, blogs, ctas, outbound, searches, funnel, heat, detail] = await Promise.all([
    sessionStats(payload, range.days),
    sessionStats(payload, range.compareDays),
    sessionsBy(payload, range.days, "device", 6),
    sessionsBy(payload, range.days, "browser", 8),
    sessionsBy(payload, range.days, "os", 8),
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

  // Engagement KPIs — derived from real session fields, framed so "up is good"
  // (engaged % rather than bounce %, so the shared change badge reads correctly).
  const engaged = stats.sessions - stats.bounces;
  const prevEngaged = prevStats.sessions - prevStats.bounces;
  const avgEng = stats.sessions > 0 ? stats.totalDurationSec / stats.sessions : 0;
  const prevAvgEng = prevStats.sessions > 0 ? prevStats.totalDurationSec / prevStats.sessions : 0;
  const perSession = stats.sessions > 0 ? stats.totalPageViews / stats.sessions : 0;
  const prevPerSession = prevStats.sessions > 0 ? prevStats.totalPageViews / prevStats.sessions : 0;
  const engPct = stats.sessions > 0 ? (engaged / stats.sessions) * 100 : 0;
  const prevEngPct = prevStats.sessions > 0 ? (prevEngaged / prevStats.sessions) * 100 : 0;

  const dimRows = (rows: typeof devices) =>
    rows.map((r) => ({ label: r.key, value: r.sessions, display: String(r.sessions) }));

  return (
    <>
      <SectionIntro>
        How visitors actually use the website — engagement depth, the pages and content they reach, the
        actions they take, and the devices they use. Every number is a real first-party event; percentages
        compare against the {range.compare === "none" ? "selected period" : "previous period"}.
      </SectionIntro>

      <div style={kpiGrid}>
        <KpiCard label="Sessions" value={String(stats.sessions)} current={stats.sessions} previous={prevStats.sessions} compare={range.compare} color={SUCCESS} sub={`${stats.visitors} unique visitors`} />
        <KpiCard label="Avg engagement time" value={fmtDur(Math.round(avgEng))} current={Math.round(avgEng)} previous={Math.round(prevAvgEng)} compare={range.compare} color={INFO} sub="active time per session" />
        <KpiCard label="Pages / session" value={perSession.toFixed(1)} current={Math.round(perSession * 100)} previous={Math.round(prevPerSession * 100)} compare={range.compare} color={ACCENT} sub={`${stats.totalPageViews} page views`} />
        <KpiCard label="Engaged sessions" value={`${engPct.toFixed(0)}%`} current={Math.round(engPct * 10)} previous={Math.round(prevEngPct * 10)} compare={range.compare} color={BRAND} sub={`${engaged} of ${stats.sessions} saw 2+ pages`} />
      </div>

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

      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Panel title="Device">
          {devices.length > 0 ? <HBars rows={dimRows(devices)} color={BRAND} valueLabel="sessions" /> : <EmptyHint text="Device mix (mobile / desktop / tablet) ranks here." />}
        </Panel>
        <Panel title="Browser">
          {browsers.length > 0 ? <HBars rows={dimRows(browsers)} color={INFO} valueLabel="sessions" /> : <EmptyHint text="Browser mix ranks here." />}
        </Panel>
        <Panel title="Operating system">
          {oses.length > 0 ? <HBars rows={dimRows(oses)} color={ACCENT} valueLabel="sessions" /> : <EmptyHint text="OS mix ranks here." />}
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

// Explicit, honest channel buckets. `source` on every session is already one of
// these — direct/organic/ai/social/email/paid/referral — so we never invent a
// classification; an unrecognised/empty value is labelled Unattributed, never
// silently folded into Direct.
const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct",
  organic: "Organic search",
  ai: "AI platforms",
  social: "Social",
  email: "Email",
  paid: "Paid",
  referral: "Referral",
};
const channelLabel = (key: string) => CHANNEL_LABELS[key] ?? (key ? key : "Unattributed");

export async function Marketing({ payload, range }: Ctx) {
  const [stats, prevStats, channels, referrers, campaigns, sources, mediums, ai] = await Promise.all([
    sessionStats(payload, range.days),
    sessionStats(payload, range.compareDays),
    sessionsBy(payload, range.days, "source", 10),
    sessionsBy(payload, range.days, "referrerDomain", 12, { referrerDomain: { $ne: "" } }),
    sessionsBy(payload, range.days, "utmCampaign", 12, { utmCampaign: { $ne: "" } }),
    sessionsBy(payload, range.days, "utmSource", 12, { utmSource: { $ne: "" } }),
    sessionsBy(payload, range.days, "utmMedium", 12, { utmMedium: { $ne: "" } }),
    sessionsBy(payload, range.days, "channel", 8, { source: "ai" }),
  ]);

  const enqRate = stats.sessions > 0 ? (stats.enquiryConversions / stats.sessions) * 100 : 0;
  const prevEnqRate = prevStats.sessions > 0 ? (prevStats.enquiryConversions / prevStats.sessions) * 100 : 0;
  const attributed = channels.filter((c) => c.key && c.key !== "direct").reduce((n, c) => n + c.sessions, 0);
  const attributedPct = stats.sessions > 0 ? (attributed / stats.sessions) * 100 : 0;
  const topChannel = [...channels].sort((a, b) => b.sessions - a.sessions)[0];

  // Conversion table with a NAMED denominator: "Enq. rate" = enquiries ÷ sessions
  // (an enquiry is a real form submission). Order/revenue are intentionally NOT
  // shown per channel here — purchase attribution is browser-observed and
  // under-counts webhook-paid orders (a known limitation), so it would mislead.
  const convTable = (rows: typeof channels, head: string, labeller: (k: string) => string) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 340 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
            <th style={{ padding: "6px 4px" }}>{head}</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>Sessions</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>Enquiries</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }} title="Enquiries ÷ sessions">Enq. rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const rate = c.sessions > 0 ? ((c.enquiries ?? 0) / c.sessions) * 100 : 0;
            return (
              <tr key={c.key} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                <td style={{ padding: "8px 4px", fontWeight: 600 }}>{labeller(c.key)}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.sessions}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.enquiries ?? 0}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: (c.enquiries ?? 0) > 0 ? 1 : 0.4 }}>
                  {(c.enquiries ?? 0) > 0 ? `${rate.toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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
      <SectionIntro>
        Where traffic comes from and which channels produce business outcomes. Channel is first-touch per
        session, from real referrer + UTM evidence only — traffic we can&rsquo;t attribute is labelled
        Unattributed, never guessed. Order/revenue attribution is browser-observed and under-counts
        webhook-paid orders, so channel performance is measured by enquiries.
      </SectionIntro>

      <div style={kpiGrid}>
        <KpiCard label="Sessions" value={String(stats.sessions)} current={stats.sessions} previous={prevStats.sessions} compare={range.compare} color={SUCCESS} sub={`${stats.visitors} unique visitors`} />
        <KpiCard label="Enquiries" value={String(stats.enquiryConversions)} current={stats.enquiryConversions} previous={prevStats.enquiryConversions} compare={range.compare} color={ACCENT} sub="form submissions in session" />
        <KpiCard label="Enquiry rate" value={`${enqRate.toFixed(1)}%`} current={Math.round(enqRate * 10)} previous={Math.round(prevEnqRate * 10)} compare={range.compare} color={BRAND} sub="enquiries ÷ sessions" />
        <KpiCard label="Attributed traffic" value={`${attributedPct.toFixed(0)}%`} current={Math.round(attributedPct * 10)} previous={0} compare="none" sub={topChannel ? `top channel: ${channelLabel(topChannel.key)}` : "non-direct sessions"} />
      </div>

      <div style={{ marginTop: 14 }}>
        <Panel title="Channels">
          {channels.length > 0 ? convTable(channels, "Channel", channelLabel) : <EmptyHint text="Traffic channels rank here once sessions arrive." />}
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Referring domains">
          {referrers.length > 0 ? convTable(referrers, "Domain", (k) => k) : <EmptyHint text="External sites that link visitors to metnmat.com rank here." />}
        </Panel>
        <Panel title="Campaign performance (utm_campaign)">
          {campaigns.length > 0 ? convTable(campaigns, "Campaign", (k) => k) : <EmptyHint text="Tag links with utm_campaign and results attribute here." />}
        </Panel>
      </div>

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

// Event types we can render on a journey, with a short human label + accent.
const EVENT_META: Record<string, { label: string; color: string }> = {
  page_view: { label: "Viewed page", color: INFO },
  page_leave: { label: "Left page", color: MUTED },
  cta_click: { label: "Clicked CTA", color: SUCCESS },
  outbound_click: { label: "Left to external site", color: MUTED },
  form_start: { label: "Started a form", color: ACCENT },
  form_submit: { label: "Submitted a form", color: BRAND },
  search: { label: "Used site search", color: INFO },
  purchase: { label: "Completed a purchase", color: BRAND },
};

/**
 * A privacy-safe view of one event's detail. We render only NON-identifying
 * fields: the CTA label, the outbound host, the form NAME, dwell/scroll. The
 * raw search term (meta.q) and anything not whitelisted is deliberately omitted
 * — a per-session timeline must not tie free text a visitor typed to their journey.
 */
function eventDetail(ev: TimelineEvent): string {
  const m = ev.meta ?? {};
  const clip = (v: unknown) => String(v ?? "").slice(0, 60);
  if (ev.type === "search") return "search term hidden for privacy";
  if (ev.type === "cta_click" && m.label) return clip(m.label);
  if (ev.type === "outbound_click" && m.to) return `→ ${clip(m.to)}`;
  if (ev.type === "form_start" || ev.type === "form_submit") return m.form ? `${clip(m.form)} form` : "";
  if (ev.type === "page_leave") {
    const bits: string[] = [];
    if (typeof m.dwell === "number") bits.push(`${Math.round(m.dwell)}s on page`);
    if (typeof m.scroll === "number") bits.push(`${Math.round(m.scroll)}% scrolled`);
    return bits.join(" · ");
  }
  if (ev.entityType && ev.entitySlug) return `${ev.entityType}: ${clip(ev.entitySlug)}`;
  return "";
}

const istTime = (d: string | Date | undefined) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }) : "—";
const istDateTime = (d: string | Date | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";

function sessionDurationSec(s: SessionRow): number {
  if (!s.startedAt || !s.lastAt) return 0;
  const d = (new Date(s.lastAt).getTime() - new Date(s.startedAt).getTime()) / 1000;
  return d > 0 && d < 2 * 3600 ? Math.round(d) : Math.max(0, Math.min(2 * 3600, Math.round(d)));
}

export async function Recordings({ payload, range, searchParams }: Ctx) {
  const focusSid = typeof searchParams.sid === "string" && /^[\w-]{6,64}$/.test(searchParams.sid) ? searchParams.sid : null;
  const [sessions, detail] = await Promise.all([
    sessionList(payload, range.days, 80),
    focusSid ? sessionTimeline(payload, focusSid) : Promise.resolve(null),
  ]);

  const outcome = (s: SessionRow) =>
    s.convertedPurchase ? { text: "Order placed", color: BRAND } : s.convertedEnquiry ? { text: "Enquiry", color: SUCCESS } : null;

  return (
    <>
      <SectionIntro>
        A truthful <strong>session-journey viewer</strong> — the real sequence of pages and actions in each
        visit, reconstructed from first-party events. This is <em>not</em> DOM/screen replay (none is captured);
        it never shows a visitor&rsquo;s identity, typed search terms, or form contents.
      </SectionIntro>

      {detail?.session && (
        <div style={{ ...panel, marginTop: 14, borderColor: BRAND }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Session journey · {focusSid?.slice(0, 8)}…</div>
            <a href={href("recordings", range)} style={{ fontSize: 12.5, color: BRAND, textDecoration: "none" }}>← back to all sessions</a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5, opacity: 0.85, marginBottom: 14 }}>
            <span><strong>{istDateTime(detail.session.startedAt)}</strong> start</span>
            <span><strong>{fmtDur(sessionDurationSec(detail.session))}</strong> duration</span>
            <span>{detail.session.country || "Unknown"}</span>
            <span>{[detail.session.device, detail.session.browser, detail.session.os].filter(Boolean).join(" · ") || "—"}</span>
            <span>{channelLabel(detail.session.source || "")}{detail.session.channel ? ` (${detail.session.channel})` : ""}</span>
            {outcome(detail.session) && <span style={{ color: outcome(detail.session)!.color, fontWeight: 700 }}>● {outcome(detail.session)!.text}</span>}
          </div>
          {detail.events.length > 0 ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
              {detail.events.map((ev, i) => {
                const meta = EVENT_META[ev.type] ?? { label: ev.type, color: MUTED };
                const dtl = eventDetail(ev);
                return (
                  <li key={i} style={{ display: "grid", gridTemplateColumns: "62px 12px 1fr", gap: 10, alignItems: "start", paddingBottom: 12 }}>
                    <span style={{ fontSize: 11.5, opacity: 0.55, fontVariantNumeric: "tabular-nums", textAlign: "right", paddingTop: 1 }}>{istTime(ev.ts)}</span>
                    <span style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: meta.color, marginTop: 3 }} />
                      {i < detail.events.length - 1 && <span style={{ position: "absolute", top: 12, width: 2, height: "100%", background: "var(--theme-elevation-150)" }} />}
                    </span>
                    <span style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 600 }}>{meta.label}</span>
                      {ev.path && <span style={{ opacity: 0.6 }}> · {ev.path}</span>}
                      {dtl && <span style={{ opacity: 0.5 }}> · {dtl}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyHint text="This session's individual events have aged out of the 180-day raw-event retention window; the summary above is preserved." />
          )}
        </div>
      )}

      <div style={{ ...panel, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Sessions in this period</div>
          <span style={{ fontSize: 11.5, opacity: 0.5 }}>most recent {sessions.length} · newest first</span>
        </div>
        {sessions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 4px" }}>Start</th>
                  <th style={{ padding: "6px 4px" }}>Location</th>
                  <th style={{ padding: "6px 4px" }}>Device</th>
                  <th style={{ padding: "6px 4px" }}>Journey</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Pages</th>
                  <th style={{ padding: "6px 4px" }}>Source</th>
                  <th style={{ padding: "6px 4px" }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const o = outcome(s);
                  return (
                    <tr key={s.sid} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                      <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>
                        <a href={href("recordings", range, { sid: s.sid })} style={{ color: "var(--theme-text)", textDecoration: "none", fontWeight: 600 }}>
                          {istDateTime(s.startedAt)}
                        </a>
                      </td>
                      <td style={{ padding: "8px 4px" }}>{s.country || "—"}</td>
                      <td style={{ padding: "8px 4px", opacity: 0.8 }}>{[s.device, s.browser].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={{ padding: "8px 4px", opacity: 0.8, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.entryPath || "—"}{s.exitPath && s.exitPath !== s.entryPath ? ` → ${s.exitPath}` : ""}
                      </td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.pageViews ?? 0}</td>
                      <td style={{ padding: "8px 4px", opacity: 0.8 }}>{channelLabel(s.source || "")}</td>
                      <td style={{ padding: "8px 4px" }}>{o ? <span style={{ color: o.color, fontWeight: 700 }}>{o.text}</span> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyHint text="No sessions recorded in this period yet. Sessions appear here as visitors browse the site." />
        )}
        <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 12, lineHeight: 1.6 }}>
          Journeys are reconstructed from first-party events (page views, clicks, forms, search — never keystrokes,
          form values or screen contents). Full DOM/screen replay is intentionally not captured. Identifiers shown
          are random per-session ids, not people.
        </p>
      </div>
    </>
  );
}

// ── Insights (rule-based; labelled honestly) ─────────────────────────────────

type Severity = "critical" | "warning" | "opportunity" | "positive" | "informational";
type Insight = { severity: Severity; finding: string; why: string; metric: string; action: string };

const SEV: Record<Severity, { label: string; color: string; rank: number }> = {
  critical: { label: "Critical", color: BRAND, rank: 0 },
  warning: { label: "Warning", color: ACCENT, rank: 1 },
  opportunity: { label: "Opportunity", color: INFO, rank: 2 },
  positive: { label: "Positive", color: SUCCESS, rank: 3 },
  informational: { label: "Info", color: MUTED, rank: 4 },
};

export async function Insights({ payload, range }: Ctx) {
  // Compare COMPLETE days only. If the range's last day is the in-progress IST
  // day, drop it (and the aligned last comparison day) so a partial "today"
  // never manufactures a false "decline" — the single biggest source of bogus
  // insights. Point-in-time (non-comparison) rules still use the full range.
  const todayIST = istDayOf(Date.now());
  const partial = range.days.length > 0 && range.days[range.days.length - 1] === todayIST;
  const curDays = partial && range.days.length > 1 ? range.days.slice(0, -1) : range.days;
  const cmpDays = partial && range.compareDays.length > 1 ? range.compareDays.slice(0, -1) : range.compareDays;
  const comparing = range.compare !== "none" && cmpDays.length > 0;

  const [rows, prevRows, stats, prevStats, pages, bySource, prevBySource, devices] = await Promise.all([
    rollupsFor(payload, curDays),
    rollupsFor(payload, cmpDays),
    sessionStats(payload, curDays),
    sessionStats(payload, cmpDays),
    pagesBy(payload, curDays, "entryPath", 25),
    sessionsBy(payload, curDays, "source", 10),
    comparing ? sessionsBy(payload, cmpDays, "source", 10) : Promise.resolve([]),
    sessionsBy(payload, curDays, "device", 6),
  ]);
  const cur = sumRollups(rows);
  const prev = sumRollups(prevRows);

  // Minimum-sample guards — nothing fires on noise. A rate/trend needs enough
  // sessions to be meaningful; a page needs enough traffic to be worth flagging.
  const MIN = 20;
  const MIN_PAGE = 8;
  const pct = (n: number) => `${(Math.abs(n) * 100).toFixed(1)}%`;
  const out: Insight[] = [];
  const push = (i: Insight) => out.push(i);

  // 1. Traffic trend (complete-day, min sample) — no double negatives.
  if (comparing && prev.sessions >= MIN) {
    const ch = (cur.sessions - prev.sessions) / prev.sessions;
    if (ch <= -0.4)
      push({ severity: "critical", finding: `Traffic fell sharply — ${pct(ch)} fewer sessions than the previous period.`, why: "A large drop in reach usually signals a broken referrer, lost ranking, or a tracking regression.", metric: `${cur.sessions} vs ${prev.sessions} sessions (complete days)`, action: "Open Marketing → Channels to see which source dropped; confirm the site and tracking are healthy." });
    else if (ch <= -0.15)
      push({ severity: "warning", finding: `Traffic is down ${pct(ch)} versus the previous period.`, why: "A sustained decline shrinks the top of the enquiry funnel.", metric: `${cur.sessions} vs ${prev.sessions} sessions`, action: "Compare channels period-over-period to isolate the source." });
    else if (ch >= 0.2)
      push({ severity: "positive", finding: `Traffic grew ${pct(ch)} versus the previous period.`, why: "More qualified reach means more enquiry potential.", metric: `${cur.sessions} vs ${prev.sessions} sessions`, action: "Check whether the growing channel also converts (Marketing → Channels)." });
  }

  // 2. Enquiry rate change (named denominator, min sample both sides).
  if (comparing && stats.sessions >= MIN && prevStats.sessions >= MIN) {
    const r = stats.enquiryConversions / stats.sessions;
    const pr = prevStats.enquiryConversions / prevStats.sessions;
    if (pr > 0 && (r - pr) / pr <= -0.2)
      push({ severity: "warning", finding: `Enquiry rate fell from ${(pr * 100).toFixed(1)}% to ${(r * 100).toFixed(1)}%.`, why: "Fewer visitors are converting — a content/CTA problem, not a traffic one.", metric: `${stats.enquiryConversions}/${stats.sessions} vs ${prevStats.enquiryConversions}/${prevStats.sessions} (enquiries ÷ sessions)`, action: "Review the highest-traffic landing pages' CTAs (flagged below)." });
    else if (r > pr && (pr === 0 || (r - pr) / pr >= 0.2))
      push({ severity: "positive", finding: `Enquiry rate rose to ${(r * 100).toFixed(1)}%.`, why: "More of the same traffic is turning into enquiries.", metric: `${stats.enquiryConversions}/${stats.sessions} vs ${prevStats.enquiryConversions}/${prevStats.sessions}`, action: "Note what changed on the converting pages and repeat it elsewhere." });
  }

  // 3. Mobile-vs-desktop conversion gap (both need a real sample).
  const mob = devices.find((d) => d.key === "mobile");
  const desk = devices.find((d) => d.key === "desktop");
  if (mob && desk && mob.sessions >= MIN && desk.sessions >= MIN) {
    const mr = (mob.enquiries ?? 0) / mob.sessions;
    const dr = (desk.enquiries ?? 0) / desk.sessions;
    if (dr > 0 && mr < dr * 0.5)
      push({ severity: "warning", finding: `Mobile converts far worse than desktop (${(mr * 100).toFixed(1)}% vs ${(dr * 100).toFixed(1)}% enquiry rate).`, why: "A mobile form/UX issue is likely costing enquiries from a large share of visitors.", metric: `mobile ${mob.enquiries ?? 0}/${mob.sessions}, desktop ${desk.enquiries ?? 0}/${desk.sessions}`, action: "Test the quote/contact forms on a real phone — tap targets, input types, validation." });
  }

  // 4. High-traffic, zero-enquiry landing pages (opportunity).
  for (const p of pages.filter((p) => p.sessions >= MIN_PAGE && p.enquiries === 0).slice(0, 3))
    push({ severity: "opportunity", finding: `“${p.path}” drew ${p.sessions} sessions but zero enquiries.`, why: "High interest with no conversion is the cheapest place to add enquiries.", metric: `${p.sessions} sessions · 0 enquiries · ${p.bounces} bounced`, action: "Add or strengthen a clear enquiry CTA on this page." });

  // 5. A channel sending traffic but converting nobody (opportunity).
  const dead = bySource.filter((s) => s.key && s.key !== "direct" && s.sessions >= MIN && (s.enquiries ?? 0) === 0).sort((a, b) => b.sessions - a.sessions)[0];
  if (dead)
    push({ severity: "opportunity", finding: `${channelLabel(dead.key)} sent ${dead.sessions} sessions but produced no enquiries.`, why: "Traffic from a channel that never converts is mistargeted or landing on the wrong page.", metric: `${dead.sessions} sessions · 0 enquiries`, action: "Check where this channel lands and whether the visitor intent matches the page." });

  // 6. Organic search trend (needs previous split + sample).
  if (comparing) {
    const org = bySource.find((s) => s.key === "organic")?.sessions ?? 0;
    const porg = prevBySource.find((s) => s.key === "organic")?.sessions ?? 0;
    if (porg >= MIN && (org - porg) / porg >= 0.25)
      push({ severity: "positive", finding: `Organic search grew ${pct((org - porg) / porg)}.`, why: "Compounding organic traffic is the most durable, lowest-cost channel.", metric: `${org} vs ${porg} organic sessions`, action: "Reinforce the ranking pages — see Behavior → most visited." });
    else if (porg >= MIN && (org - porg) / porg <= -0.25)
      push({ severity: "warning", finding: `Organic search fell ${pct((org - porg) / porg)}.`, why: "Losing organic reach is expensive to rebuild.", metric: `${org} vs ${porg} organic sessions`, action: "Check for de-indexed pages, ranking losses, or a technical SEO regression." });
  }

  // 7. Best converting channel (positive; ≥2 enquiries so it isn't a 1-off tautology).
  const best = [...bySource].sort((a, b) => (b.enquiries ?? 0) - (a.enquiries ?? 0))[0];
  if (best && (best.enquiries ?? 0) >= 2)
    push({ severity: "positive", finding: `${channelLabel(best.key)} is your best-converting channel this period.`, why: "Knowing what already works tells you where to invest.", metric: `${best.enquiries} enquiries from ${best.sessions} sessions`, action: "Put more effort into the channel that already converts." });

  // 8. Form abandonment (min sample; the dedup caveat can't cause a false positive here).
  if (cur.formStarts >= 10 && cur.formSubmits < cur.formStarts * 0.5)
    push({ severity: "warning", finding: `Only ${cur.formSubmits} of ${cur.formStarts} form starts were completed.`, why: "People are trying to reach you and abandoning mid-form.", metric: `${((cur.formSubmits / cur.formStarts) * 100).toFixed(0)}% completion`, action: "Shorten the form / cut required fields; check for validation friction." });

  // 9. AI-assistant traffic (informational — an emerging discovery channel).
  const ai = bySource.find((s) => s.key === "ai");
  if (ai && ai.sessions > 0)
    push({ severity: "informational", finding: `${ai.sessions} session${ai.sessions === 1 ? "" : "s"} arrived from AI assistants.`, why: "AI answer engines are a growing discovery channel worth tracking.", metric: `${ai.sessions} AI-referred sessions`, action: "Keep llms.txt and structured data describing METNMAT accurately (GEO)." });

  const insights = out.sort((a, b) => SEV[a.severity].rank - SEV[b.severity].rank).slice(0, 10);
  const enoughData = stats.sessions >= 5;

  return (
    <>
      <SectionIntro>
        Evidence-based, deterministic signals computed from your own analytics — <strong>never AI-generated
        conclusions</strong>. Each is traceable to a real metric and a period, guarded by a minimum sample so
        noise doesn&rsquo;t manufacture alarms. Comparisons use complete days only.
      </SectionIntro>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "12px 0 2px" }}>
        {(Object.keys(SEV) as Severity[]).map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, opacity: 0.75 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: SEV[s].color }} />
            {SEV[s].label}
          </span>
        ))}
      </div>

      <div style={{ ...panel, marginTop: 12 }}>
        {insights.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {insights.map((i, n) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "4px 1fr", gap: 12, borderBottom: n < insights.length - 1 ? "1px solid var(--theme-elevation-100)" : "none", paddingBottom: 12 }}>
                <div style={{ background: SEV[i.severity].color, borderRadius: 2 }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: SEV[i.severity].color }}>{SEV[i.severity].label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{i.finding}</span>
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.5 }}>{i.why}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>Evidence: {i.metric}</div>
                  <div style={{ fontSize: 12.5, marginTop: 5 }}>
                    <span style={{ color: BRAND, fontWeight: 700 }}>Do: </span>
                    <span style={{ opacity: 0.9 }}>{i.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint
            text={
              enoughData
                ? "Nothing notable this period — metrics are within their normal range, which is itself a good sign."
                : "Not enough data in this range yet to say anything with confidence. Insights need a minimum sample before they fire (guarding against false alarms)."
            }
          />
        )}
      </div>
    </>
  );
}

// ── Benchmarks (internal historical) ─────────────────────────────────────────

export async function Benchmarks({ payload }: Ctx) {
  const now = Date.now();
  const DAY = 86_400_000;
  const firstDay = await firstEventDay(payload);

  // Complete-day history (never the in-progress day): every window ends
  // YESTERDAY so the current period isn't a partial day compared against
  // complete ones — the bias that made all three old windows drift down.
  const dayStr = (epoch: number) => istDayOf(epoch);
  const yEpoch = now - DAY;
  const allDays: string[] = [];
  if (firstDay) {
    for (let e = yEpoch; ; e -= DAY) {
      const d = dayStr(e);
      if (d < firstDay) break;
      allDays.unshift(d);
      if (allDays.length > 800) break;
    }
  }
  const histDays = allDays.length;

  if (!firstDay || histDays < 2) {
    return (
      <>
        <SectionIntro>
          How current performance compares against your own history — internal baselines only, never invented
          industry numbers. Uses fixed complete-day windows and ignores the date selector above.
        </SectionIntro>
        <div style={{ ...panel, marginTop: 14 }}>
          <EmptyHint text="Not enough history yet for benchmarks. They begin once the site has a couple of complete days of analytics, and unlock longer windows (30 / 90 / 365 days) as history accumulates." />
        </div>
      </>
    );
  }

  // N complete days ending at endEpoch's day, clamped to the first day of data.
  const windowDays = (len: number, endEpoch: number): string[] => {
    const out: string[] = [];
    for (let i = len - 1; i >= 0; i--) {
      const d = dayStr(endEpoch - i * DAY);
      if (firstDay && d >= firstDay && d <= allDays[allDays.length - 1]) out.push(d);
    }
    return out;
  };

  // Only show a window we can actually fill (≥60% of its length in real days),
  // so a site with 10 days of data doesn't render three identical rows with a
  // fake "New" on every cell.
  const candidates = [
    { label: "Last 7 days", len: 7 },
    { label: "Last 30 days", len: 30 },
    { label: "Last 90 days", len: 90 },
    { label: "Last 12 months", len: 365 },
  ];
  const shown = candidates.filter((c) => histDays >= Math.ceil(c.len * 0.6));
  if (shown.length === 0) shown.push({ label: `History so far (${histDays} day${histDays === 1 ? "" : "s"})`, len: histDays });

  const rows = await Promise.all(
    shown.map(async (w) => {
      const curDays = windowDays(w.len, yEpoch);
      const prevDays = windowDays(w.len, yEpoch - w.len * DAY);
      const [cr, pr, cs, ps] = await Promise.all([
        rollupsFor(payload, curDays),
        rollupsFor(payload, prevDays),
        sessionStats(payload, curDays),
        sessionStats(payload, prevDays),
      ]);
      // A like-for-like comparison needs the prior window mostly covered by real
      // history; otherwise we show the value as a baseline, never a bogus "New".
      const hasPrev = prevDays.length >= Math.ceil(w.len * 0.6);
      return { label: w.label, cur: sumRollups(cr), prev: sumRollups(pr), cs, ps, hasPrev, curLen: curDays.length, len: w.len };
    })
  );

  type Row = (typeof rows)[number];
  const metrics: { label: string; cur: (r: Row) => number; prev: (r: Row) => number; fmt?: (n: number) => string; rate?: boolean }[] = [
    { label: "Sessions", cur: (r) => r.cs.sessions, prev: (r) => r.ps.sessions },
    { label: "Unique visitors", cur: (r) => r.cs.visitors, prev: (r) => r.ps.visitors },
    { label: "Page views", cur: (r) => r.cur.pageViews, prev: (r) => r.prev.pageViews },
    { label: "Enquiries", cur: (r) => r.cs.enquiryConversions, prev: (r) => r.ps.enquiryConversions },
    {
      label: "Enquiry rate",
      cur: (r) => (r.cs.sessions > 0 ? (r.cs.enquiryConversions / r.cs.sessions) * 100 : 0),
      prev: (r) => (r.ps.sessions > 0 ? (r.ps.enquiryConversions / r.ps.sessions) * 100 : 0),
      fmt: (n) => `${n.toFixed(1)}%`,
      rate: true,
    },
  ];

  return (
    <>
      <SectionIntro>
        How current performance compares against your own history — <strong>internal baselines only</strong>, no
        invented industry numbers. Each window compares the trailing period against the equal period before it,
        using complete days only. Windows unlock as history accumulates.
      </SectionIntro>

      <div style={{ ...panel, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Internal historical benchmarks</div>
          <span style={{ fontSize: 11.5, opacity: 0.5 }}>{histDays} days of history since {firstDay} · complete days only</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 620 }}>
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
                  <td style={{ padding: "9px 4px", fontWeight: 600 }}>
                    {r.label}
                    {r.curLen < r.len && <span style={{ fontSize: 10.5, opacity: 0.5, fontWeight: 400 }}> · {r.curLen}d of data</span>}
                  </td>
                  {metrics.map((m) => {
                    const c = m.cur(r);
                    const p = m.prev(r);
                    const d = delta(c, p);
                    return (
                      <td key={m.label} style={{ padding: "9px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <strong>{m.fmt ? m.fmt(c) : Math.round(c).toLocaleString("en-IN")}</strong>{" "}
                        {r.hasPrev ? (
                          <span style={{ fontSize: 11, color: d.up ? SUCCESS : BRAND }}>{d.text}</span>
                        ) : (
                          <span style={{ fontSize: 11, opacity: 0.4 }} title="Not enough prior history for a like-for-like comparison">baseline</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 12, lineHeight: 1.6 }}>
          Each metric shows the trailing-window total (or rate) with its change versus the equal period before it.
          &ldquo;baseline&rdquo; means there isn&rsquo;t enough earlier history for a fair comparison yet — never a
          fabricated jump. Revenue benchmarking lives on Highlights (authoritative Orders records); purchase events
          here are client-observed and under-count webhook-paid orders, so they are deliberately not benchmarked.
        </p>
      </div>
    </>
  );
}

// ── All Reports ───────────────────────────────────────────────────────────────

export function Reports({ range }: Ctx) {
  // Each interactive report links to a DISTINCT destination (the old list had 12
  // of 16 links pointing at the same 3 pages). Range/compare carry through so a
  // report opens on the same period the user is viewing.
  const reports: { label: string; desc: string; href: string }[] = [
    { label: "Traffic & geography", desc: "Sessions, sources, channels, AI referrals, landing/exit pages, world map.", href: href("traffic", range) },
    { label: "Behavior & content", desc: "Pages, products/projects/blog, CTAs, forms funnel, search, device mix.", href: href("behavior", range) },
    { label: "Marketing & channels", desc: "Channel buckets, referring domains, UTM campaigns, enquiry rate by source.", href: href("marketing", range) },
    { label: "Session journeys", desc: "Per-session event timelines — how individual visits actually unfolded.", href: href("recordings", range) },
    { label: "Insights", desc: "Evidence-based, severity-ranked signals with a recommended action.", href: href("insights", range) },
    { label: "Benchmarks", desc: "Current performance vs your own history (internal baselines).", href: href("benchmarks", range) },
    { label: "Business (orders, revenue, RFQs)", desc: "Authoritative commerce analytics from the Orders/Enquiries records.", href: href("business", range) },
    { label: "Real-time", desc: "Live visitors on the map + the last few minutes of activity.", href: href("realtime", range) },
  ];
  const records = [
    { label: "Orders", href: "/admin/collections/orders" },
    { label: "Enquiries (RFQ)", href: "/admin/collections/enquiries" },
    { label: "Quotations", href: "/admin/collections/quotations" },
  ];

  const from = range.days[0];
  const to = range.days[range.days.length - 1];
  const ex = (type: string) => `/api/analytics-daily/export?type=${type}&from=${from}&to=${to}`;
  const exports = [
    { label: "Daily rollups", type: "daily" },
    { label: "Traffic by channel", type: "channels" },
    { label: "Referring domains", type: "referrers" },
    { label: "UTM campaigns", type: "campaigns" },
    { label: "Top pages", type: "pages" },
    { label: "Landing pages", type: "landing" },
    { label: "Geography (country)", type: "geography" },
    { label: "Device mix", type: "devices" },
    { label: "Search terms", type: "searches" },
  ];

  return (
    <>
      <SectionIntro>
        The reporting workspace — jump to any analysis for the current period, open the underlying business
        records, or export a report as CSV. Every export honours the selected date range above and opens in
        Excel/Sheets cleanly (UTF-8, quoted). Order/revenue columns are marked client-observed where they
        aren&rsquo;t the authoritative Orders figures.
      </SectionIntro>

      <div style={grid2}>
        <Panel title="Interactive reports">
          <div style={{ display: "grid", gap: 10 }}>
            {reports.map((r) => (
              <a key={r.label} href={r.href} style={{ display: "block", textDecoration: "none", color: "var(--theme-text)", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 9 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label} <span style={{ color: BRAND }}>→</span></div>
                <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 2 }}>{r.desc}</div>
              </a>
            ))}
          </div>
        </Panel>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <Panel title="CSV exports (current range)">
            <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 8 }}>
              {from} → {to}. Each file reflects this exact window.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {exports.map((e) => (
                <a key={e.type} href={ex(e.type)} style={{ fontSize: 13, color: "var(--theme-text)", textDecoration: "none", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                  ⬇ {e.label} <span style={{ opacity: 0.4 }}>.csv</span>
                </a>
              ))}
            </div>
          </Panel>

          <Panel title="Business records">
            <div style={{ display: "grid", gap: 8 }}>
              {records.map((r) => (
                <a key={r.label} href={r.href} style={{ fontSize: 13, color: "var(--theme-text)", textDecoration: "none", borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 6 }}>
                  {r.label} <span style={{ color: BRAND }}>→</span>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 14, lineHeight: 1.6, maxWidth: 820 }}>
        To segment further, open a report above and use its own breakdowns (channel, device, source, page).
        Deeper cross-filtered exports (e.g. sessions by country <em>and</em> device) aren&rsquo;t generated yet —
        rather than ship a filter that silently ignores some dimensions, the exports cover one dimension each,
        accurately.
      </p>
    </>
  );
}

export { RangeBar };
