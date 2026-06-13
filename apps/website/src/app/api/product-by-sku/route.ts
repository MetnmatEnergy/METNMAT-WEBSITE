import { NextResponse } from "next/server";
import { getProductBySku } from "@/frontend/lib/cms";

/**
 * Same-origin product lookup for the chat cart bridge (the browser asks the
 * website, the website asks the CMS server-side — no cross-origin fetch needed).
 */
export async function GET(request: Request) {
  const sku = new URL(request.url).searchParams.get("sku")?.trim();
  if (!sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }
  const product = await getProductBySku(sku);
  if (!product) {
    return NextResponse.json({ error: "product not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}
