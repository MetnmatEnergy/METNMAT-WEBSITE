import React from "react";
import type { Payload } from "payload";

/**
 * METNMAT Operations Dashboard — analytics control center shown at the top of
 * /admin. Real-data KPIs (revenue, orders, customers, enquiries) with
 * sparklines, a 12-month revenue chart, an order-status donut, recent orders,
 * top products, and quick links — all computed from the live database.
 * Server component; Payload injects the `payload` instance. No chart libs:
 * everything is hand-rendered SVG so the build stays lean.
 */
type Props = { payload?: Payload };

const BRAND = "#d81f26";
// Per-theme hues from custom-admin.css so pills/charts stay readable in BOTH
// light and dark mode (raw dark-tuned hexes wash out on white surfaces).
const SUCCESS = "var(--mn-success)";
const WARNING = "var(--mn-warning)";
const DANGER = "var(--mn-danger)";
const INFO = "var(--mn-info)";
const ACCENT = "var(--mn-accent)";
const PURPLE = "var(--mn-purple)";
const MUTED = "var(--mn-muted)";
const STATUS_COLOR: Record<string, string> = {
  paid: SUCCESS,
  pending: WARNING,
  shipped: INFO,
  delivered: ACCENT,
  failed: DANGER,
  cancelled: MUTED,
  refunded: PURPLE,
};
/** Soft tint of a status colour for pill backgrounds (works with CSS vars). */
const tint = (color: string) => `color-mix(in srgb, ${color} 14%, transparent)`;
const PAID_STATUSES = new Set(["paid", "shipped", "delivered"]);

const panel: React.CSSProperties = {
  background: "var(--theme-elevation-50)",
  border: "1px solid var(--theme-elevation-100)",
  borderRadius: 16,
  padding: 20,
};

// ── Data helpers ──────────────────────────────────────────────────────────────
type OrderDoc = {
  orderNumber?: string;
  name?: string;
  email?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  items?: { productName?: string; qty?: number; lineTotal?: number }[];
};

async function safeFind<T = Record<string, unknown>>(
  payload: Payload | undefined,
  collection: string,
  limit = 500
): Promise<T[]> {
  if (!payload) return [];
  try {
    const res = await payload.find({
      collection: collection as never,
      limit,
      depth: 0,
      sort: "-createdAt",
    });
    return res.docs as T[];
  } catch {
    return [];
  }
}

async function safeCount(payload: Payload | undefined, collection: string): Promise<number> {
  if (!payload) return 0;
  try {
    return (await payload.count({ collection: collection as never })).totalDocs;
  } catch {
    return 0;
  }
}

/** Build the last `n` month buckets ending with the current month. */
function monthKeys(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

function monthKeyOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");
const inrCompact = (n: number) => {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "k";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};

function pctChange(series: number[]): { text: string; up: boolean } {
  if (series.length < 2) return { text: "—", up: true };
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) return { text: last > 0 ? "New" : "—", up: last >= 0 };
  const pct = ((last - prev) / prev) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: pct >= 0 };
}

// ── SVG primitives ──────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120;
  const h = 36;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  // Sanitised: colours may be CSS var() strings, and url(#id) refs break on
  // parentheses/spaces.
  const id = `spk-${color.replace(/[^a-zA-Z0-9-]/g, "")}-${data.join("").length}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ months, values, color }: { months: string[]; values: number[]; color: string }) {
  const w = 640;
  const h = 220;
  const padB = 24;
  const padL = 6;
  const max = Math.max(...values, 1);
  const n = values.length;
  const slot = (w - padL) / n;
  const barW = Math.min(26, slot * 0.5);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Monthly revenue" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={padL} x2={w} y1={(h - padB) * (1 - g)} y2={(h - padB) * (1 - g)} stroke="var(--theme-elevation-100)" strokeWidth={1} />
      ))}
      {values.map((v, i) => {
        const bh = ((h - padB) * v) / max;
        const x = padL + i * slot + (slot - barW) / 2;
        return (
          <g key={i}>
            <rect x={x} y={h - padB - bh} width={barW} height={Math.max(bh, 1)} rx={4} fill={color} opacity={0.92} />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize={10} fill="var(--theme-elevation-500)">
              {months[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 180;
  const r = 70;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--theme-elevation-100)" strokeWidth={18} />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={18}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      <text x={c} y={c - 4} textAnchor="middle" fontSize={26} fontWeight={800} fill="var(--theme-text)">
        {total}
      </text>
      <text x={c} y={c + 16} textAnchor="middle" fontSize={11} fill="var(--theme-elevation-500)">
        orders
      </text>
    </svg>
  );
}

function ChangeBadge({ change }: { change: { text: string; up: boolean } }) {
  const color = change.up ? SUCCESS : BRAND;
  return (
    <span style={{ color, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {change.text !== "—" && change.text !== "New" ? (change.up ? "▲" : "▼") : ""} {change.text}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default async function BeforeDashboard({ payload }: Props) {
  const months = monthKeys(12);
  const [orders, enquiries, productsCount, openTickets] = await Promise.all([
    safeFind<OrderDoc>(payload, "orders"),
    safeFind<{ createdAt?: string }>(payload, "enquiries"),
    safeCount(payload, "products"),
    (async () => {
      if (!payload) return 0;
      try {
        return (
          await payload.count({
            collection: "orders" as never,
            where: { status: { in: ["paid", "pending"] } } as never,
          })
        ).totalDocs;
      } catch {
        return 0;
      }
    })(),
  ]);

  // Monthly aggregation
  const revByMonth = new Map(months.map((m) => [m.key, 0]));
  const ordByMonth = new Map(months.map((m) => [m.key, 0]));
  const custByMonth = new Map<string, Set<string>>(months.map((m) => [m.key, new Set()]));
  const enqByMonth = new Map(months.map((m) => [m.key, 0]));
  const statusCounts = new Map<string, number>();
  const productAgg = new Map<string, { units: number; revenue: number }>();
  const customers = new Set<string>();
  let totalRevenue = 0;
  let paidCount = 0;

  for (const o of orders) {
    const mk = monthKeyOf(o.createdAt);
    if (ordByMonth.has(mk)) ordByMonth.set(mk, (ordByMonth.get(mk) || 0) + 1);
    if (o.email) {
      customers.add(o.email.toLowerCase());
      if (custByMonth.has(mk)) custByMonth.get(mk)!.add(o.email.toLowerCase());
    }
    statusCounts.set(o.status || "pending", (statusCounts.get(o.status || "pending") || 0) + 1);
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

  const revSeries = months.map((m) => revByMonth.get(m.key) || 0);
  const ordSeries = months.map((m) => ordByMonth.get(m.key) || 0);
  const custSeries = months.map((m) => (custByMonth.get(m.key)?.size ?? 0));
  const enqSeries = months.map((m) => enqByMonth.get(m.key) || 0);
  const monthLabels = months.map((m) => m.label);

  const kpis = [
    { label: "Total earnings", value: inrCompact(totalRevenue), sub: `${paidCount} paid orders`, series: revSeries, color: SUCCESS, change: pctChange(revSeries) },
    { label: "Total orders", value: String(orders.length), sub: `${openTickets} need action`, series: ordSeries, color: BRAND, change: pctChange(ordSeries) },
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

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Operations overview</h2>
        <span style={{ fontSize: 12.5, opacity: 0.55 }}>Live data · edits go live on the website within a minute</span>
      </div>

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
            <BarChart months={monthLabels} values={revSeries} color={BRAND} />
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
                    <td style={{ padding: "9px 4px", fontWeight: 600 }}>{o.orderNumber || "—"}</td>
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

      <QuickLinks />
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13, opacity: 0.5, padding: "26px 4px", textAlign: "center" }}>{text}</div>
  );
}

function QuickLinks() {
  const groups: { title: string; links: { label: string; href: string; primary?: boolean }[] }[] = [
    {
      title: "Sales",
      links: [
        { label: "Orders", href: "/admin/collections/orders" },
        { label: "Support tickets", href: "/admin/collections/tickets" },
        { label: "Enquiries (RFQ)", href: "/admin/collections/enquiries" },
      ],
    },
    {
      title: "Shop catalog",
      links: [
        { label: "Products", href: "/admin/collections/products" },
        { label: "Categories", href: "/admin/collections/categories" },
        { label: "+ Add product", href: "/admin/collections/products/create", primary: true },
      ],
    },
    {
      title: "Website content",
      links: [
        { label: "Blog articles", href: "/admin/collections/posts" },
        { label: "Publication requests", href: "/admin/collections/blog-submissions" },
        { label: "Projects", href: "/admin/collections/projects" },
        { label: "Services", href: "/admin/collections/services" },
        { label: "Team", href: "/admin/collections/team" },
        { label: "+ New article", href: "/admin/collections/posts/create", primary: true },
      ],
    },
    {
      title: "Site & administration",
      links: [
        { label: "Homepage", href: "/admin/globals/homepage" },
        { label: "Navigation", href: "/admin/globals/navigation" },
        { label: "Maintenance banner", href: "/admin/globals/maintenance" },
        { label: "Staff roles", href: "/admin/collections/staff-roles" },
        { label: "Staff users", href: "/admin/collections/users" },
      ],
    },
  ];
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
      {groups.map((g) => (
        <div key={g.title} style={panel}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{g.title}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {g.links.map((l) => (
              <a
                key={l.href + l.label}
                href={l.href}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "none",
                  color: l.primary ? "#fff" : "var(--theme-text)",
                  background: l.primary ? BRAND : "var(--theme-elevation-100)",
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
  );
}
