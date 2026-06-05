/**
 * MongoDB connection helper (skeleton).
 *
 * The tech stack uses MongoDB Atlas as the single source of truth. When you're
 * ready to connect, install the driver and uncomment the implementation below:
 *
 *   pnpm --filter website add mongodb
 *
 * For now this is a stub so the backend layer compiles without a DB.
 * TODO(backend): wire the real client + connection caching.
 */
import { env } from "@/backend/config/env";

// import { MongoClient, type Db } from "mongodb";
// let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<unknown> {
  if (!env.mongoUri) {
    throw new Error("[backend] MONGODB_URI is not set — cannot connect to MongoDB.");
  }

  // --- Real implementation (uncomment once `mongodb` is installed) ---
  // if (cached) return cached.db;
  // const client = new MongoClient(env.mongoUri);
  // await client.connect();
  // cached = { client, db: client.db(env.mongoDb) };
  // return cached.db;

  throw new Error("[backend] getDb() not implemented yet — see src/backend/db/mongo.ts");
}
