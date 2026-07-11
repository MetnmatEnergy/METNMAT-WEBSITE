import React from "react";
import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import {
  BRAND,
  SUCCESS,
  INFO,
  ACCENT,
  MUTED,
  STATUS_COLOR,
  PAID_STATUSES,
  panel,
  inr,
  inrCompact,
  pctChange,
  monthKeys,
  monthKeyOf,
  Sparkline,
  LineArea,
  BarChart,
  Donut,
  HBars,
  ChangeBadge,
  EmptyHint,
} from "./charts";

/**
 * /admin/analytics — the deep-dive business analytics view (Wix-style
 * "Analytics" sidebar section). Everything on this page is computed live from
 * the database: orders, customers, enquiries. No third-party analytics, no
 * invented numbers — if a metric can't be derived from real collections it
 * isn't shown.
 */

type OrderDoc = {
  status?: string;
  total?: number;
  email?: string;
  country?: string;
  createdAt?: string;
  items?: { productName?: string; qty?: number; lineTotal?: number }[];
};

export default async function AnalyticsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  // Auth-gate: custom views must enforce this themselves.
  if (!initPageResult?.req?.user) redirect("/admin/login");
  const { payload } = initPageResult.req;

  const months = monthKeys(12);
  const [ordersRes, customersRes, enquiriesRes] = await Promise.all([
    payload.find({ collection: "orders" as never, limit: 1000, depth: 0, sort: "-createdAt" }).catch(() => ({ docs: [] })),
    payload.find({ collection: "customers" as never, limit: 1000, depth: 0, sort: "-createdAt" }).catch(() => ({ docs: [] })),
    payload.find({ collection: "enquiries" as never, limit: 1000, depth: 0, sort: "-createdAt" }).catch(() => ({ docs: [] })),
  ]);
  const orders = ordersRes.docs as OrderDoc[];
  const customersDocs = customersRes.docs as { createdAt?: string }[];
  const enquiries = enquiriesRes.docs as { createdAt?: string }[];

  // ── Aggregations ──────────────────────────────────────────────────────────
  const revByMonth = new Map(months.map((m) => [m.key, 0]));
  const ordByMonth = new Map(months.map((m) => [m.key, 0]));
  const signupsByMonth = new Map(months.map((m) => [m.key, 0]));
  const enqByMonth = new Map(months.map((m) => [m.key, 0]));
  const statusCounts = new Map<string, number>();
  const productAgg = new Map<string, { units: number; revenue: number }>();
  const countryAgg = new Map<string, number>();
  const paidPerBuyer = new Map<string, number>();
  let totalRevenue = 0;
  let paidCount = 0;

  for (const o of orders) {
    const mk = monthKeyOf(o.createdAt);
    if (ordByMonth.has(mk)) ordByMonth.set(mk, (ordByMonth.get(mk) || 0) + 1);
    statusCounts.set(o.status || "pending", (statusCounts.get(o.status || "pending") || 0) + 1);
    if (PAID_STATUSES.has(o.status || "")) {
      const t = o.total || 0;
      totalRevenue += t;
      paidCount += 1;
      if (revByMonth.has(mk)) revByMonth.set(mk, (revByMonth.get(mk) || 0) + t);
      const buyer = (o.email || "").toLowerCase();
      if (buyer) paidPerBuyer.set(buyer, (paidPerBuyer.get(buyer) || 0) + 1);
      const country = (o.country || "India").trim() || "India";
      countryAgg.set(country, (countryAgg.get(country) || 0) + t);
      for (const it of o.items || []) {
        const name = it.productName || "Unknown";
        const agg = productAgg.get(name) || { units: 0, revenue: 0 };
        agg.units += it.qty || 0;
        agg.revenue += it.lineTotal || 0;
        productAgg.set(name, agg);
      }
    }
  }
  for (const c of customersDocs) {
    const mk = monthKeyOf(c.createdAt);
    if (signupsByMonth.has(mk)) signupsByMonth.set(mk, (signupsByMonth.get(mk) || 0) + 1);
  }
  for (const e of enquiries) {
    const mk = monthKeyOf(e.createdAt);
    if (enqByMonth.has(mk)) enqByMonth.set(mk, (enqByMonth.get(mk) || 0) + 1);
  }

  const labels = months.map((m) => m.label);
  const revSeries = months.map((m) => revByMonth.get(m.key) || 0);
  const ordSeries = months.map((m) => ordByMonth.get(m.key) || 0);
  const signupSeries = months.map((m) => signupsByMonth.get(m.key) || 0);
  const enqSeries = months.map((m) => enqByMonth.get(m.key) || 0);

  const aov = paidCount > 0 ? totalRevenue / paidCount : 0;
  const buyers = paidPerBuyer.size;
  const repeatBuyers = [...paidPerBuyer.values()].filter((n) => n >= 2).length;
  const repeatRate = buyers > 0 ? (repeatBuyers / buyers) * 100 : 0;
  const paidConversion = orders.length > 0 ? (paidCount / orders.length) * 100 : 0;

  const kpis = [
    { label: "Revenue (12 mo)", value: inrCompact(totalRevenue), sub: `${paidCount} paid orders`, series: revSeries, color: SUCCESS, change: pctChange(revSeries) },
    { label: "Avg. order value", value: inrCompact(aov), sub: "paid orders only", series: revSeries.map((v, i) => (ordSeries[i] ? v / ordSeries[i] : 0)), color: INFO, change: pctChange(revSeries.map((v, i) => (ordSeries[i] ? v / ordSeries[i] : 0))) },
    { label: "Paid conversion", value: `${paidConversion.toFixed(0)}%`, sub: `of ${orders.length} checkouts started`, series: ordSeries, color: ACCENT, change: pctChange(ordSeries) },
    { label: "Repeat buyers", value: `${repeatRate.toFixed(0)}%`, sub: `${repeatBuyers} of ${buyers} buyers ordered again`, series: signupSeries, color: BRAND, change: pctChange(signupSeries) },
  ];

  const donutSegments = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ label: status, value: count, color: STATUS_COLOR[status] || MUTED }));

  const topProducts = [...productAgg.entries()]
    .map(([name, agg]) => ({ label: name, value: agg.revenue, display: inrCompact(agg.revenue), units: agg.units }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topCountries = [...countryAgg.entries()]
    .map(([name, rev]) => ({ label: name, value: rev, display: inrCompact(rev) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

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
        <div style={{ paddingBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Analytics</h1>
            <span style={{ fontSize: 12.5, opacity: 0.55 }}>Last 12 months · computed live from orders, customers &amp; enquiries</span>
          </div>

          {/* KPI row */}
          <div style={{ display: "grid", gap: 14, marginTop: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {kpis.map((k) => (
              <div key={k.label} style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 12.5, opacity: 0.6 }}>{k.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                  </div>
                  <ChangeBadge change={k.change} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={k.series} color={k.color} />
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Revenue trend + status */}
          <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
            <div style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Revenue &amp; orders trend</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{inr(totalRevenue)}</div>
                </div>
                <span style={{ fontSize: 11.5, opacity: 0.55 }}>
                  <span style={{ color: SUCCESS }}>■</span> revenue&nbsp;&nbsp;
                  <span style={{ color: BRAND }}>┅</span> orders
                </span>
              </div>
              {orders.length > 0 ? (
                <LineArea months={labels} a={revSeries} b={ordSeries} colorA={SUCCESS} colorB={BRAND} ariaLabel="Revenue and orders by month" />
              ) : (
                <EmptyHint text="Paid orders will chart here." />
              )}
            </div>
            <div style={panel}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Order status</div>
              {orders.length > 0 ? (
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <Donut segments={donutSegments} />
                  <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 120 }}>
                    {donutSegments.map((s) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, textTransform: "capitalize" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                          {s.label}
                        </span>
                        <strong>{s.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyHint text="No orders to break down yet." />
              )}
            </div>
          </div>

          {/* Customers + enquiries growth */}
          <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>New customer accounts</div>
                <a href="/admin/collections/customers" style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>View all →</a>
              </div>
              {customersDocs.length > 0 ? (
                <BarChart months={labels} values={signupSeries} color={INFO} ariaLabel="New customers by month" />
              ) : (
                <EmptyHint text="Customer signups will chart here." />
              )}
            </div>
            <div style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Quote requests (RFQ)</div>
                <a href="/admin/collections/enquiries" style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>View all →</a>
              </div>
              {enquiries.length > 0 ? (
                <BarChart months={labels} values={enqSeries} color={ACCENT} ariaLabel="Enquiries by month" />
              ) : (
                <EmptyHint text="Quote requests will chart here." />
              )}
            </div>
          </div>

          {/* Top products + countries */}
          <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div style={panel}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Top products by revenue</div>
              {topProducts.length > 0 ? (
                <HBars rows={topProducts.map((p) => ({ label: `${p.label} · ${p.units}u`, value: p.value, display: p.display }))} color={BRAND} />
              ) : (
                <EmptyHint text="Best-sellers will rank here once orders come in." />
              )}
            </div>
            <div style={panel}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Revenue by country</div>
              {topCountries.length > 0 ? (
                <HBars rows={topCountries} color={INFO} />
              ) : (
                <EmptyHint text="Order destinations will rank here." />
              )}
            </div>
          </div>
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
