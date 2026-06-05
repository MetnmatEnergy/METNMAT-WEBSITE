// Demo: change a product's price directly in MongoDB (what the dashboard does
// under the hood) to prove the website reflects edits live. Usage: node update-demo.cjs <price>
const fs = require("fs");
const path = require("path");
const { MongoClient } = require(
  path.join(__dirname, "..", "..", "node_modules", ".pnpm", "mongodb@6.20.0", "node_modules", "mongodb")
);
const uri = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/^MONGODB_URI=(.*)$/m)[1].trim();
const price = Number(process.argv[2]);
(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const r = await c.db().collection("products").updateOne(
    { slug: "zirconia-crucible" },
    { $set: { price } }
  );
  console.log(`zirconia-crucible price set to ${price} (matched=${r.matchedCount}, modified=${r.modifiedCount})`);
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
