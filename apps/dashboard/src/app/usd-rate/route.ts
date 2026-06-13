import { getPayload } from "payload";
import config from "@payload-config";
import { getInrPerUsd } from "../../lib/exchange-rate";

export const dynamic = "force-dynamic";

/**
 * Live ₹-per-$1 rate for the admin USD-price hint. Reuses the same fallback
 * chain as the website. getPayload() returns the already-initialised instance,
 * so this is cheap. Never errors — always returns a usable number.
 */
export async function GET(): Promise<Response> {
  let inrPerUsd = 84;
  try {
    const payload = await getPayload({ config });
    inrPerUsd = await getInrPerUsd(payload);
  } catch {
    try {
      inrPerUsd = await getInrPerUsd();
    } catch {
      /* keep 84 */
    }
  }
  return Response.json({ inrPerUsd });
}
