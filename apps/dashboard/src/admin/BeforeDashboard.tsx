import React from "react";
import { headers as nextHeaders } from "next/headers";
import type { Payload } from "payload";
import { hasRoleOrArea } from "../access";
import {
  BRAND,
  SUCCESS,
  WARNING,
  DANGER,
  INFO,
  ACCENT,
  MUTED,
  STATUS_COLOR,
  PAID_STATUSES,
  panel,
  tint,
  inr,
  inrCompact,
  pctChange,
  monthKeys,
  monthKeyOf,
  timeAgo,
  Sparkline,
  BarChart,
  Donut,
  ChangeBadge,
  EmptyHint,
} from "./charts";

/**
 * METNMAT control center — the Wix-style home shown at /admin. Personalised
 * welcome + one-click actions, a "needs attention" strip, real-data KPIs with
 * sparklines, revenue chart, order-status donut, recent orders, top products,
 * and a live activity feed from the audit log. Server component; everything is
 * computed from the live database — no invented numbers anywhere.
 */
type Props = { payload?: Payload };

type OrderDoc = {
  id?: string;
  orderNumber?: string;
  name?: string;
  email?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  items?: { productName?: string; qty?: number; lineTotal?: number }[];
};

type AuditDoc = {
  action?: string;
  collectionSlug?: string;
  documentId?: string;
  documentLabel?: string;
  userEmail?: string;
  createdAt?: string;
};

async function safeFind<T = Record<string, unknown>>(
  payload: Payload | undefined,
  collection: string,
  limit = 500,
  where?: Record<string, unknown>
): Promise<T[]> {
  if (!payload) return [];
  try {
    const res = await payload.find({
      collection: collection as never,
      limit,
      depth: 0,
      sort: "-createdAt",
      ...(where ? { where: where as never } : {}),
    });
    return res.docs as T[];
  } catch {
    return [];
  }
}

async function safeCount(
  payload: Payload | undefined,
  collection: string,
  where?: Record<string, unknown>
): Promise<number> {
  if (!payload) return 0;
  try {
    return (
      await payload.count({ collection: collection as never, ...(where ? { where: where as never } : {}) })
    ).totalDocs;
  } catch {
    return 0;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default async function BeforeDashboard({ payload }: Props) {
  const months = monthKeys(12);

  // Who's signed in — for the personalised welcome AND to scope what this home
  // page fetches: the local API below bypasses collection access
  // (overrideAccess defaults true), so without this gate content-only staff
  // (e.g. marketing) would still see revenue/order data despite lacking
  // canManageOrders (audit finding 2026-07-13).
  let firstName = "";
  let canSeeSales = false;
  try {
    if (payload) {
      const { user } = await payload.auth({ headers: await nextHeaders() });
      firstName = String((user as { name?: string } | null)?.name || "").split(" ")[0] || "";
      canSeeSales = hasRoleOrArea(
        user,
        ["super-admin", "admin", "operations-manager", "sales"],
        ["sales", "operations"]
      );
    }
  } catch {
    /* greeting is optional; sales data stays hidden on auth failure */
  }

  const [orders, enquiries, audit, openTickets, newSubmissions, stockProducts] = await Promise.all([
    canSeeSales ? safeFind<OrderDoc>(payload, "orders") : Promise.resolve<OrderDoc[]>([]),
    safeFind<{ createdAt?: string }>(payload, "enquiries"),
    safeFind<AuditDoc>(payload, "audit-logs", 8),
    safeCount(payload, "tickets", { status: { in: ["open", "in-progress", "waiting"] } }),
    safeCount(payload, "blog-submissions", { status: { equals: "new" } }),
    safeFind<{ id?: string; name?: string; stockQty?: number; lowStockThreshold?: number; productType?: string }>(
      payload,
      "products",
      400
    ),
  ]);

  // ── Aggregations (12 months) ───────────────────────────────────────────────
  const revByMonth = new Map(months.map((m) => [m.key, 0]));
  const ordByMonth = new Map(months.map((m) => [m.key, 0]));
  const custByMonth = new Map<string, Set<string>>(months.map((m) => [m.key, new Set()]));
  const enqByMonth = new Map(months.map((m) => [m.key, 0]));
  const statusCounts = new Map<string, number>();
  const productAgg = new Map<string, { units: number; revenue: number }>();
  const customers = new Set<string>();
  let totalRevenue = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const o of orders) {
    const mk = monthKeyOf(o.createdAt);
    if (ordByMonth.has(mk)) ordByMonth.set(mk, (ordByMonth.get(mk) || 0) + 1);
    if (o.email) {
      customers.add(o.email.toLowerCase());
      if (custByMonth.has(mk)) custByMonth.get(mk)!.add(o.email.toLowerCase());
    }
    statusCounts.set(o.status || "pending", (statusCounts.get(o.status || "pending") || 0) + 1);
    if (o.status === "pending") pendingCount += 1;
    if (PAID_STATUSES.has(o.status || "")) {
      const t = o.total || 0;
      totalRevenue += t;
      paidCount += 1;
      if (revByMonth.has(mk)) revByMonth.set(mk, (revByMonth.get(mk) || 0) + t);
      for (const it of o.items || []) {
        const name = it.productName || "Unknown";
        const agg = productAgg.get(name) || { units: 0, revenue: 0 };
        agg.units += it.qty || 0;
        agg.revenue += it.lineTotal || 0;
        productAgg.set(name, agg);
      }
    }
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let newEnquiries = 0;
  for (const e of enquiries) {
    const mk = monthKeyOf(e.createdAt);
    if (enqByMonth.has(mk)) enqByMonth.set(mk, (enqByMonth.get(mk) || 0) + 1);
    if (e.createdAt && new Date(e.createdAt).getTime() >= weekAgo) newEnquiries += 1;
  }

  const lowStock = stockProducts.filter(
    (p) =>
      (p.productType === "in-stock" || !p.productType) &&
      typeof p.stockQty === "number" &&
      p.stockQty <= (p.lowStockThreshold ?? 5)
  );

  const revSeries = months.map((m) => revByMonth.get(m.key) || 0);
  const ordSeries = months.map((m) => ordByMonth.get(m.key) || 0);
  const custSeries = months.map((m) => custByMonth.get(m.key)?.size ?? 0);
  const enqSeries = months.map((m) => enqByMonth.get(m.key) || 0);
  const monthLabels = months.map((m) => m.label);

  const kpis = [
    { label: "Total earnings", value: inrCompact(totalRevenue), sub: `${paidCount} paid orders`, series: revSeries, color: SUCCESS, change: pctChange(revSeries) },
    { label: "Total orders", value: String(orders.length), sub: `${pendingCount} awaiting payment`, series: ordSeries, color: BRAND, change: pctChange(ordSeries) },
    { label: "Customers", value: String(customers.size), sub: "unique buyers", series: custSeries, color: INFO, change: pctChange(custSeries) },
    { label: "Enquiries (RFQ)", value: String(enquiries.length), sub: `${newEnquiries} new this week`, series: enqSeries, color: ACCENT, change: pctChange(enqSeries) },
  ];

  const donutSegments = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ label: status, value: count, color: STATUS_COLOR[status] || MUTED }));

  const topProducts = [...productAgg.entries()]
    .map(([name, agg]) => ({ name, ...agg }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const recent = orders.slice(0, 6);
  const site = (process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "");

  // "Needs attention" — only real, actionable items; hidden entirely when clear.
  const attention: { label: string; count: number; href: string; color: string }[] = [
    { label: "orders awaiting payment", count: pendingCount, href: "/admin/collections/orders?where[status][equals]=pending", color: WARNING },
    { label: "open support tickets", count: openTickets, href: "/admin/collections/tickets", color: DANGER },
    { label: "new blog submissions", count: newSubmissions, href: "/admin/collections/blog-submissions?where[status][equals]=new", color: INFO },
    { label: "products low on stock", count: lowStock.length, href: "/admin/collections/products", color: BRAND },
  ].filter((a) => a.count > 0);

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Welcome + one-click actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>
            Welcome back{firstName ? `, ${firstName}` : ""} 👋
          </h2>
          <span style={{ fontSize: 12.5, opacity: 0.55 }}>Live data · edits go live on the website within a minute</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ActionButton href={site} external primary label="View live site ↗" />
          <ActionButton href="/admin/globals/homepage" label="Edit homepage" />
          <ActionButton href="/admin/collections/products/create" label="+ Add product" />
          <ActionButton href="/admin/collections/posts/create" label="+ New article" />
          <ActionButton href="/admin/analytics" label="Analytics →" />
        </div>
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div
          style={{
            ...panel,
            marginTop: 16,
            padding: "12px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <strong style={{ fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.6 }}>
            Needs attention
          </strong>
          {attention.map((a) => (
            <a
              key={a.label}
              href={a.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                textDecoration: "none",
                color: a.color,
                background: tint(a.color),
                borderRadius: 999,
                padding: "5px 12px",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{a.count}</span> {a.label} →
            </a>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "grid", gap: 14, marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
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

      {/* Revenue + status */}
      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{inr(totalRevenue)}</div>
            </div>
            <span style={{ fontSize: 11.5, opacity: 0.5 }}>Last 12 months · paid orders</span>
          </div>
          {orders.length > 0 ? (
            <BarChart months={monthLabels} values={revSeries} color={BRAND} ariaLabel="Monthly revenue" />
          ) : (
            <EmptyHint text="No orders yet. Paid orders from the website checkout will chart here." />
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

      {/* Recent orders + top products */}
      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Recent orders</div>
            <a href="/admin/collections/orders" style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>View all →</a>
          </div>
          {recent.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.55, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={{ padding: "6px 4px" }}>Order</th>
                  <th style={{ padding: "6px 4px" }}>Customer</th>
                  <th style={{ padding: "6px 4px" }}>Total</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--theme-elevation-100)" }}>
                    <td style={{ padding: "9px 4px", fontWeight: 600 }}>
                      {o.id ? (
                        <a href={`/admin/collections/orders/${o.id}`} style={{ color: "var(--theme-text)", textDecoration: "none" }}>
                          {o.orderNumber || "—"}
                        </a>
                      ) : (
                        o.orderNumber || "—"
                      )}
                    </td>
                    <td style={{ padding: "9px 4px", opacity: 0.85 }}>{o.name || "—"}</td>
                    <td style={{ padding: "9px 4px", fontVariantNumeric: "tabular-nums" }}>{inr(o.total || 0)}</td>
                    <td style={{ padding: "9px 4px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                          padding: "3px 9px",
                          borderRadius: 999,
                          color: STATUS_COLOR[o.status || "pending"] || MUTED,
                          background: tint(STATUS_COLOR[o.status || "pending"] || MUTED),
                        }}
                      >
                        {o.status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyHint text="Orders placed on the website will appear here." />
          )}
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Top products</div>
          {topProducts.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {topProducts.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--theme-elevation-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>{p.units} unit{p.units === 1 ? "" : "s"} sold</div>
                  </div>
                  <strong style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{inrCompact(p.revenue)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint text="Best-selling products will rank here once orders come in." />
          )}
        </div>
      </div>

      {/* Activity feed + management shortcuts */}
      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)" }}>
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Activity feed</div>
            <a href="/admin/collections/audit-logs" style={{ color: BRAND, fontSize: 12.5, textDecoration: "none" }}>Full audit trail →</a>
          </div>
          {audit.length > 0 ? (
            <div style={{ display: "grid", gap: 2 }}>
              {audit.map((a, i) => {
                const verb = a.action === "create" ? "created" : a.action === "delete" ? "deleted" : "updated";
                const target = a.documentLabel || a.documentId || "";
                const href =
                  a.collectionSlug && a.documentId && a.action !== "delete"
                    ? `/admin/collections/${a.collectionSlug}/${a.documentId}`
                    : a.collectionSlug
                      ? `/admin/collections/${a.collectionSlug}`
                      : "/admin/collections/audit-logs";
                return (
                  <a
                    key={i}
                    href={href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 6px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "var(--theme-text)",
                      borderTop: i === 0 ? "none" : "1px solid var(--theme-elevation-100)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: a.action === "create" ? SUCCESS : a.action === "delete" ? DANGER : INFO,
                      }}
                    />
                    <span style={{ fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      <strong>{a.userEmail || "System"}</strong> {verb}{" "}
                      <span style={{ opacity: 0.8 }}>{a.collectionSlug?.replace(/-/g, " ")}</span>
                      {target ? <span style={{ opacity: 0.65 }}> · {target}</span> : null}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>{timeAgo(a.createdAt)}</span>
                  </a>
                );
              })}
            </div>
          ) : (
            <EmptyHint text="Staff edits will appear here as they happen." />
          )}
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Manage</div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { title: "Sales", links: [
                { label: "Orders", href: "/admin/collections/orders" },
                { label: "Shipments", href: "/admin/collections/shipments" },
                { label: "RFQs", href: "/admin/collections/enquiries" },
              ] },
              { title: "Site & Mobile App", links: [
                { label: "Homepage", href: "/admin/globals/homepage" },
                { label: "Navigation", href: "/admin/globals/navigation" },
                { label: "Media", href: "/admin/collections/media" },
              ] },
              { title: "Marketing", links: [
                { label: "SEO", href: "/admin/globals/seo" },
                { label: "Social links", href: "/admin/globals/social" },
                { label: "Blog", href: "/admin/collections/posts" },
              ] },
              { title: "Inbox", links: [
                { label: "Support tickets", href: "/admin/collections/tickets" },
                { label: "Notifications", href: "/admin/collections/notifications" },
              ] },
            ].map((g) => (
              <div key={g.title}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.55, marginBottom: 6 }}>{g.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        textDecoration: "none",
                        color: "var(--theme-text)",
                        background: "var(--theme-elevation-100)",
                        borderRadius: 999,
                        padding: "6px 12px",
                      }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  href,
  label,
  primary,
  external,
}: {
  href: string;
  label: string;
  primary?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        textDecoration: "none",
        color: primary ? "#fff" : "var(--theme-text)",
        background: primary ? BRAND : "var(--theme-elevation-100)",
        borderRadius: 999,
        padding: "8px 15px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </a>
  );
}
