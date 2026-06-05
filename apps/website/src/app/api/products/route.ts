import { NextResponse } from "next/server";
import { listProducts } from "@/backend/services/catalog.service";

// GET /api/products — list catalog products.
export async function GET() {
  const products = await listProducts();
  return NextResponse.json({ ok: true, data: products });
}
