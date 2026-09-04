import { describe, it, expect } from "vitest";
import {
  SERVICE_ICONS,
  bentoRows,
  bentoSpan,
  serviceIcon,
} from "../apps/website/src/frontend/lib/service-icons";

/**
 * The services grid must not strand a card.
 *
 * Services are CMS-editable, so the count is not a constant. A bento tuned to
 * exactly the eight that exist today would leave a nine-service catalogue with
 * one card alone in a half-empty row — the kind of break nobody sees until a
 * staff member adds a service and the page quietly looks wrong.
 *
 * So the rows are computed, and the property that matters is simple: every row
 * is full, and the rows account for every card. These tests assert that for
 * every count the site could plausibly have, rather than for the one it has.
 */

describe("the grid accounts for every card", () => {
  const COUNTS = Array.from({ length: 31 }, (_, i) => i);

  it.each(COUNTS)("%i services are all placed", (n) => {
    expect(bentoRows(n).reduce((a, b) => a + b, 0)).toBe(n);
  });

  it.each(COUNTS)("%i services leave no empty row", (n) => {
    expect(bentoRows(n).every((r) => r > 0)).toBe(true);
  });

  it("never strands a single card beside a wide one", () => {
    // A row of 1 is only acceptable when there is genuinely one service.
    for (let n = 2; n <= 30; n++) {
      expect(bentoRows(n).includes(1), `count ${n}`).toBe(false);
    }
  });

  it("only ever uses rows of two or three above the trivial cases", () => {
    for (let n = 3; n <= 30; n++) {
      for (const row of bentoRows(n)) {
        expect([2, 3], `count ${n} produced a row of ${row}`).toContain(row);
      }
    }
  });

  it("puts the wider row first, so the feature row is at the top", () => {
    for (let n = 3; n <= 30; n++) {
      const rows = bentoRows(n);
      const sorted = [...rows].sort((a, b) => a - b);
      expect(rows, `count ${n}`).toEqual(sorted);
    }
  });
});

describe("the shapes the real counts produce", () => {
  it("eight services — today's catalogue — is a feature row over two even rows", () => {
    expect(bentoRows(8)).toEqual([2, 3, 3]);
  });

  it("a ninth service does not break the layout", () => {
    // The case a hardcoded grid would have stranded.
    expect(bentoRows(9)).toEqual([3, 3, 3]);
  });

  it("small catalogues stay sensible", () => {
    expect(bentoRows(0)).toEqual([]);
    expect(bentoRows(1)).toEqual([1]);
    expect(bentoRows(2)).toEqual([2]);
    expect(bentoRows(3)).toEqual([3]);
    expect(bentoRows(4)).toEqual([2, 2]);
    expect(bentoRows(5)).toEqual([2, 3]);
    expect(bentoRows(6)).toEqual([3, 3]);
    expect(bentoRows(7)).toEqual([2, 2, 3]);
  });

  it("a negative or nonsense count renders nothing rather than throwing", () => {
    expect(bentoRows(-3)).toEqual([]);
  });
});

describe("the spans add up to a full row", () => {
  it("each row fills the six-column grid", () => {
    // 1x6, 2x3 and 3x2 all total six. A mismatch here is a visibly ragged row.
    const cols = (span: string) => Number(span.replace("lg:col-span-", ""));
    expect(cols(bentoSpan(1)) * 1).toBe(6);
    expect(cols(bentoSpan(2)) * 2).toBe(6);
    expect(cols(bentoSpan(3)) * 3).toBe(6);
  });
});

describe("service icons resolve from the CMS value", () => {
  it("maps the values the CMS offers", () => {
    for (const key of ["rocket", "lightbulb", "gauge", "target", "flame", "cpu", "microscope", "factory"]) {
      expect(SERVICE_ICONS[key], key).toBeTruthy();
    }
  });

  it("falls back rather than rendering nothing", () => {
    expect(serviceIcon(undefined)).toBe(SERVICE_ICONS.rocket);
    expect(serviceIcon("not-a-real-icon")).toBe(SERVICE_ICONS.rocket);
  });

  it("returns the named icon when there is one", () => {
    expect(serviceIcon("factory")).toBe(SERVICE_ICONS.factory);
  });

  it("the card stack uses the shared map rather than its own copy", () => {
    // Two copies of this lookup is how one surface silently starts falling back
    // to the default for a value the other renders correctly.
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/frontend/components/ui/service-card-stack.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from "@\/frontend\/lib\/service-icons"/);
    expect(src, "the local ICONS map should be gone").not.toMatch(/^const ICONS: Record<string, LucideIcon> = \{/m);
  });
});
