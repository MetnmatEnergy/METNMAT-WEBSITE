// One-off: clear all products & categories (and their version docs) so the new
// catalog can be re-seeded fresh on next boot. Runs at the DB layer.
const fs = require("fs");
const path = require("path");
const { MongoClient } = require(
  path.join(__dirname, "..", "..", "node_modules", ".pnpm", "mongodb@6.20.0", "node_modules", "mongodb")
);
const uri = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/^MONGODB_URI=(.*)$/m)[1].trim();

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  for (const name of ["products", "categories"]) {
    const r = await db.collection(name).deleteMany({});
    console.log(`${name}: deleted ${r.deletedCount}`);
  }
  // version collections (products has drafts → versions)
  const cols = await db.listCollections().toArray();
  for (const col of cols.filter((c) => /(product|categor).*version/i.test(c.name))) {
    const r = await db.collection(col.name).deleteMany({});
    console.log(`${col.name}: deleted ${r.deletedCount}`);
  }
  await client.close();
})().catch((e) => {
  console.error("RESET ERROR:", e.message);
  process.exit(1);
});
