// One-off: remove malformed product imports directly at the DB layer.
// Targets ONLY docs with a string `category` (should be an ObjectId) or empty slug.
const fs = require("fs");
const path = require("path");
const { MongoClient } = require(
  path.join(__dirname, "..", "..", "node_modules", ".pnpm", "mongodb@6.20.0", "node_modules", "mongodb")
);

function readEnv() {
  const env = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  const m = env.match(/^MONGODB_URI=(.*)$/m);
  return m ? m[1].trim() : "";
}

(async () => {
  const uri = process.env.MONGODB_URI || readEnv();
  if (!uri) throw new Error("MONGODB_URI not found");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const products = db.collection("products");
  const filter = {
    $or: [
      { category: { $type: "string" } },
      { slug: { $in: ["", null] } },
      { slug: { $exists: false } },
    ],
  };
  const before = await products.countDocuments();
  const res = await products.deleteMany(filter);
  const after = await products.countDocuments();
  console.log(`products before=${before} deleted=${res.deletedCount} after=${after}`);

  // Also clear any product version docs referencing the same bad data.
  const cols = await db.listCollections().toArray();
  for (const c of cols.filter((c) => /product.*version/i.test(c.name))) {
    const r = await db.collection(c.name).deleteMany({
      $or: [{ "version.category": { $type: "string" } }, { "version.slug": { $in: ["", null] } }],
    });
    console.log(`${c.name}: deleted=${r.deletedCount}`);
  }

  await client.close();
})().catch((e) => {
  console.error("CLEANUP ERROR:", e.message);
  process.exit(1);
});
