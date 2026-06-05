import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  background: "#161618",
  border: "1px solid #262629",
  borderRadius: 16,
  padding: "20px 22px",
};

async function getStats() {
  const payload = await getPayload({ config });
  const [products, categories, media, documents, users, audits] = await Promise.all([
    payload.count({ collection: "products" }),
    payload.count({ collection: "categories" }),
    payload.count({ collection: "media" }),
    payload.count({ collection: "documents" }),
    payload.count({ collection: "users" }),
    payload.find({ collection: "audit-logs", limit: 6, sort: "-createdAt", depth: 0 }),
  ]);
  return {
    products: products.totalDocs,
    categories: categories.totalDocs,
    media: media.totalDocs,
    documents: documents.totalDocs,
    users: users.totalDocs,
    activity: audits.docs as Array<{
      action?: string;
      collectionSlug?: string;
      documentLabel?: string;
      userEmail?: string;
      createdAt?: string;
    }>,
  };
}

export default async function OverviewPage() {
  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let error: string | null = null;
  try {
    stats = await getStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the database.";
  }

  const tiles = stats
    ? [
        { label: "Products", value: stats.products, href: "/admin/collections/products" },
        { label: "Categories", value: stats.categories, href: "/admin/collections/categories" },
        { label: "Media assets", value: stats.media, href: "/admin/collections/media" },
        { label: "Documents", value: stats.documents, href: "/admin/collections/documents" },
        { label: "Team members", value: stats.users, href: "/admin/collections/users" },
      ]
    : [];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 44, height: 44, borderRadius: 10, background: "#d81f26",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 22,
            }}
          >
            M
          </span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>METNMAT Dashboard</div>
            <div style={{ fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 2 }}>
              Operations Overview
            </div>
          </div>
        </div>
        <Link
          href="/admin"
          style={{
            background: "#d81f26", color: "#fff", textDecoration: "none",
            padding: "11px 20px", borderRadius: 999, fontWeight: 600, fontSize: 14,
          }}
        >
          Manage content →
        </Link>
      </header>

      {error && (
        <div style={{ ...card, marginTop: 28, borderColor: "#7f1d1d", color: "#fca5a5" }}>
          Couldn&apos;t load stats: {error} — check that MONGODB_URI is set and the cluster allows this IP.
        </div>
      )}

      {/* Stat tiles */}
      <section style={{ marginTop: 28, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} style={{ ...card, textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{t.value}</div>
            <div style={{ marginTop: 4, color: "#a1a1aa", fontSize: 14 }}>{t.label}</div>
          </Link>
        ))}
      </section>

      {/* Two-column: quick links + recent activity */}
      <section style={{ marginTop: 16, display: "grid", gap: 16, gridTemplateColumns: "1fr", }}>
        <div style={{ ...card }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Website traffic &amp; sales analytics</div>
          <div style={{ color: "#a1a1aa", fontSize: 14 }}>
            {/* TODO(analytics): wire GA4 + orders/RFQ once the storefront backend is live. */}
            Coming soon — connects to GA4 (visitors, top pages) and orders/RFQs once payments &amp; the
            enquiry backend are wired. For now this panel tracks your content.
          </div>
        </div>

        <div style={{ ...card }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Recent activity (audit log)</div>
          {stats && stats.activity.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {stats.activity.map((a, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, borderBottom: "1px solid #232326", paddingBottom: 10 }}>
                  <span>
                    <span style={{ textTransform: "uppercase", fontSize: 11, color: "#d81f26", fontWeight: 700 }}>{a.action}</span>
                    {" "}
                    <span style={{ color: "#e4e4e7" }}>{a.documentLabel || a.collectionSlug}</span>
                    <span style={{ color: "#71717a" }}> · {a.collectionSlug}</span>
                  </span>
                  <span style={{ color: "#71717a", whiteSpace: "nowrap" }}>{a.userEmail || "system"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#a1a1aa", fontSize: 14 }}>No activity yet — changes you make in the admin appear here.</div>
          )}
        </div>
      </section>

      <p style={{ marginTop: 28, color: "#71717a", fontSize: 13 }}>
        Content management (products, media, settings, users &amp; roles) lives in{" "}
        <Link href="/admin" style={{ color: "#d81f26" }}>/admin</Link>. First time? Create your Super Admin at{" "}
        <Link href="/admin/create-first-user" style={{ color: "#d81f26" }}>/admin/create-first-user</Link>.
      </p>
    </main>
  );
}
