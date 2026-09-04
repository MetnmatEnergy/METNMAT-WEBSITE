import type { PayloadRequest } from "payload";
import { hasRoleOrArea, type Role } from "../access";
import { recordStockMovement, recountStock } from "../lib/stock";
import { availableStock, type MovementType } from "../lib/stock-math";

/**
 * POST /api/products/stock-movement
 *
 * The authorized way to change stock. Until this existed the only way to alter
 * inventory was to type a new number into the `stockQty` field, which wrote no
 * ledger row, recorded no reason and no author, and could silently overwrite a
 * concurrent change.
 *
 * Body is one of:
 *   { id, movementType, quantity, reason? }   a directional movement
 *   { id, countedQty, reason? }               a physical recount
 *
 * Authorization mirrors `canManageInventory` on the collection exactly, so the
 * endpoint cannot become a way around the collection's own rules. It is checked
 * here on the server; nothing about the UI is trusted.
 *
 * A business refusal — "only 3 in stock" — is a 422 carrying the real reason, so
 * the admin panel can show the operator what actually stopped it rather than a
 * generic failure.
 */

const DIRECTIONAL: ReadonlySet<string> = new Set([
  "stock-in",
  "stock-out",
  "reserved",
  "released",
  "damaged",
  "returned",
]);

/** The roles and areas that may move stock — the same set as canManageInventory. */
const INVENTORY_ROLES: Role[] = ["super-admin", "admin", "operations-manager", "inventory"] as Role[];

export async function stockMovementHandler(req: PayloadRequest): Promise<Response> {
  const { payload } = req;

  const user = req.user as { roles?: Role[]; email?: string; id?: string } | null;
  if (!hasRoleOrArea(user, INVENTORY_ROLES, ["operations"])) {
    return Response.json({ error: "You do not have permission to change stock." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await (req as unknown as { json: () => Promise<Record<string, unknown>> }).json()) ?? {};
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return Response.json({ error: "Missing product id." }, { status: 400 });

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;
  const userId = user?.id ? String(user.id) : undefined;

  try {
    const isRecount = body.countedQty !== undefined && body.countedQty !== null && body.countedQty !== "";

    const result = isRecount
      ? await recountStock(
          payload,
          { productId: id, countedQty: Number(body.countedQty), reason, ...(userId ? { userId } : {}) },
          req,
        )
      : await (async () => {
          const movementType = String(body.movementType ?? "");
          if (!DIRECTIONAL.has(movementType)) {
            return { ok: false as const, error: `"${movementType}" is not a stock movement.` };
          }
          return recordStockMovement(
            payload,
            {
              productId: id,
              movementType: movementType as Exclude<MovementType, "adjustment">,
              quantity: Number(body.quantity),
              reason,
              ...(userId ? { userId } : {}),
            },
            req,
          );
        })();

    if (!result.ok) {
      // Expected refusals — not enough stock, reserved, bad quantity. The
      // operator needs the actual reason, so it is returned verbatim.
      return Response.json({ error: result.error }, { status: 422 });
    }

    payload.logger.info(
      {
        product: id,
        by: user?.email,
        movement: isRecount ? "adjustment" : String(body.movementType),
        from: result.previous,
        to: result.next,
      },
      "[stock] movement recorded",
    );

    return Response.json({
      ok: true,
      previous: result.previous,
      next: result.next,
      available: availableStock(result.next),
      ledgerId: result.ledgerId,
    });
  } catch (err) {
    payload.logger.error({ err, product: id }, "[stock] movement failed");
    // Never leak internals to the browser; the detail is in the server log.
    return Response.json({ error: "Stock movement failed — check the server log." }, { status: 500 });
  }
}
