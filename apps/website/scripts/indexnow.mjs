// Tell Bing (which feeds ChatGPT search and Copilot) and the other IndexNow engines
// which metnmat.com URLs changed. No daily 100-URL limit, unlike Bing's web form.
//
//   node apps/website/scripts/indexnow.mjs              every URL in the sitemaps
//   node apps/website/scripts/indexnow.mjs --days=2     URLs whose lastmod is recent
//   node apps/website/scripts/indexnow.mjs --dry-run    list them, send nothing
//
// The key is public by design: IndexNow proves ownership by finding the same value
// at https://www.metnmat.com/<key>.txt (apps/website/public).
const KEY = "eb790e7e399c70852a3500da9cf3966b";
const SITE = "https://www.metnmat.com";

const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 0);
const dry = process.argv.includes("--dry-run");
const since = days ? Date.now() - days * 86_400_000 : 0;

const text = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
};
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const urls = [];
for (const sitemap of locs(await text(`${SITE}/sitemap.xml`))) {
  const xml = await text(sitemap);
  for (const entry of xml.split("<url>").slice(1)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (loc && (!since || !lastmod || Date.parse(lastmod) >= since)) urls.push(loc);
  }
}
const unique = [...new Set(urls)];
console.log(`${unique.length} URLs${days ? ` changed in the last ${days} days` : ""}`);
if (dry || !unique.length) process.exit(0);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "www.metnmat.com", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: unique.slice(0, 10_000) }),
});
console.log(`IndexNow answered ${res.status} ${res.statusText}`);
// 200 and 202 both mean accepted; 403 means the key file is not live yet.
if (res.status !== 200 && res.status !== 202) process.exit(1);
