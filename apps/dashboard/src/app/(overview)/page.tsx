import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload, type Payload, type TypedUser } from "payload";
import config from "@payload-config";

export const dynamic = "force-dynamic";

const card: React.CSSProperties = {
  background: "#161618",
  border: "1px solid #262629",
  borderRadius: 16,
  padding: "20px 22px",
};

async function getStats(payload: Payload, user: TypedUser) {
  /*
   * `overrideAccess` defaults to TRUE on the Local API, so these ran as though
   * nobody were asking and each collection's own `read` rule never executed.
   * Passing the user makes those rules a second line of defence behind the staff
   * check in the caller, rather than something this page quietly bypasses.
   *
   * A staff member who cannot read a collection now sees 0 for it instead of a
   * real number, which is the honest answer to "what are you allowed to see".
   */
  const as = { overrideAccess: false, user } as const;
  const [products, categories, media, documents, users, enquiries, services, projects, posts, faqs, team, recent] =
    await Promise.all([
      payload.count({ collection: "products", ...as }),
      payload.count({ collection: "categories", ...as }),
      payload.count({ collection: "media", ...as }),
      payload.count({ collection: "documents", ...as }),
      payload.count({ collection: "users", ...as }),
      payload.count({ collection: "enquiries", ...as }),
      payload.count({ collection: "services", ...as }),
      payload.count({ collection: "projects", ...as }),
      payload.count({ collection: "posts", ...as }),
      payload.count({ collection: "faqs", ...as }),
      payload.count({ collection: "team", ...as }),
      payload.find({ collection: "enquiries", limit: 6, sort: "-createdAt", depth: 0, ...as }),
    ]);
  return {
    products: products.totalDocs,
    categories: categories.totalDocs,
    media: media.totalDocs,
    documents: documents.totalDocs,
    users: users.totalDocs,
    enquiries: enquiries.totalDocs,
    services: services.totalDocs,
    projects: projects.totalDocs,
    posts: posts.totalDocs,
    faqs: faqs.totalDocs,
    team: team.totalDocs,
    requests: recent.docs as Array<{
      name?: string;
      productName?: string;
      status?: string;
      createdAt?: string;
    }>,
  };
}

export default async function OverviewPage() {
  const payload = await getPayload({ config });

  /*
   * SECURITY: this overview renders live counts + recent enquiry PII. It is NOT
   * part of Payload's authenticated /admin shell, so without a gate it leaks to
   * any visitor.
   *
   * The gate must check WHICH auth collection resolved, not merely that one did.
   * `customers` is a second auth collection with `create: () => true`, and this
   * host serves its REST endpoints — so anyone could register at
   * POST /api/customers on admin.metnmat.com, sign in, and satisfy a bare
   * `!user`, then read the six most recent customization requests' customer
   * names, the product each asked about, and the size of every collection
   * including the staff roster. No PIN, no staff account, no admin role.
   *
   * access/index.ts warns about exactly this, and SiteAnalyticsView and
   * AnalyticsDaily both make the check this page was missing.
   */
  const { user } = await payload.auth({ headers: new Headers(await headers()) });
  if (!user || user.collection !== "users") redirect("/admin/login");

  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let error: string | null = null;
  try {
    stats = await getStats(payload, user);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the database.";
  }

  const tiles = stats
    ? [
        { label: "Enquiries (RFQ)", value: stats.enquiries, href: "/admin/collections/enquiries", accent: true },
        { label: "Products", value: stats.products, href: "/admin/collections/products" },
        { label: "Categories", value: stats.categories, href: "/admin/collections/categories" },
        { label: "Services", value: stats.services, href: "/admin/collections/services" },
        { label: "Projects", value: stats.projects, href: "/admin/collections/projects" },
        { label: "Blog posts", value: stats.posts, href: "/admin/collections/posts" },
        { label: "FAQs", value: stats.faqs, href: "/admin/collections/faqs" },
        { label: "Team", value: stats.team, href: "/admin/collections/team" },
        { label: "Media assets", value: stats.media, href: "/admin/collections/media" },
        { label: "Documents", value: stats.documents, href: "/admin/collections/documents" },
        { label: "Staff accounts", value: stats.users, href: "/admin/collections/users" },
      ]
    : [];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 44, height: 44, borderRadius: 10, background: "#fff", padding: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/metnmat-mark.png" alt="METNMAT" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>METNMAT Operations Dashboard</div>
            <div style={{ fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 2 }}>
              Control center
            </div>
          </div>
        </div>
        <Link
          href="/admin"
          style={{ background: "#d81f26", color: "#fff", textDecoration: "none", padding: "11px 20px", borderRadius: 999, fontWeight: 600, fontSize: 14 }}
        >
          Manage content →
        </Link>
      </header>

      {error && (
        <div style={{ ...card, marginTop: 28, borderColor: "#7f1d1d", color: "#fca5a5" }}>
          Couldn&apos;t load stats: {error} — check that MONGODB_URI is set and the cluster allows this IP.
        </div>
      )}

      <section style={{ marginTop: 28, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} style={{ ...card, textDecoration: "none", color: "inherit", display: "block", borderColor: t.accent ? "#d81f26" : "#262629" }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{t.value}</div>
            <div style={{ marginTop: 4, color: "#a1a1aa", fontSize: 14 }}>{t.label}</div>
          </Link>
        ))}
      </section>

      <section style={{ marginTop: 16, display: "grid", gap: 16 }}>
        <div style={{ ...card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Recent customization requests</div>
            <Link href="/admin/collections/enquiries" style={{ color: "#d81f26", fontSize: 13, textDecoration: "none" }}>View all →</Link>
          </div>
          {stats && stats.requests.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {stats.requests.map((r, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, borderBottom: "1px solid #232326", paddingBottom: 10 }}>
                  <span>
                    <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{r.name || "—"}</span>
                    <span style={{ color: "#71717a" }}> · {r.productName || "general"}</span>
                  </span>
                  <span style={{ textTransform: "uppercase", fontSize: 11, color: "#d81f26", fontWeight: 700 }}>{r.status || "new"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#a1a1aa", fontSize: 14 }}>
              No requests yet — submissions from the website&apos;s &ldquo;Request for Customization&rdquo; form appear here.
            </div>
          )}
        </div>

        <div style={{ ...card }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Website traffic &amp; sales analytics</div>
          <div style={{ color: "#a1a1aa", fontSize: 14 }}>
            Coming soon — connects to GA4 (visitors, top pages) and orders once payments are wired.
          </div>
        </div>
      </section>

      <p style={{ marginTop: 28, color: "#71717a", fontSize: 13 }}>
        Content management lives in{" "}
        <Link href="/admin" style={{ color: "#d81f26" }}>/admin</Link>.
      </p>
    </main>
  );
}
