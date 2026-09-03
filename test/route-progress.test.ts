import { describe, it, expect } from "vitest";
import { targetPathname } from "../apps/website/src/frontend/lib/route-progress";

/**
 * The bar exists because a nav click on a dynamic route gives no feedback for
 * the third of a second the server takes. But a bar that flashes when nothing is
 * navigating is worse than no bar — it teaches people to ignore it.
 *
 * So the interesting cases are the ones that must NOT trigger it, and there are
 * far more of those than of the ones that must.
 */

const ORIGIN = "https://www.metnmat.com";

/** The function under test, with the origin bound. */
const target = (e: MouseEvent, current: string) => targetPathname(e, current, ORIGIN);

/** A stand-in for the click: only the fields targetPathname reads. */
function click(
  href: string | null,
  opts: Partial<{
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
    target: string;
    download: boolean;
    noAnchor: boolean;
  }> = {}
): MouseEvent {
  const anchor = {
    getAttribute: (n: string) => (n === "href" ? href : n === "target" ? (opts.target ?? null) : null),
    hasAttribute: (n: string) => n === "download" && Boolean(opts.download),
    closest: () => anchor,
  };
  return {
    defaultPrevented: opts.defaultPrevented ?? false,
    button: opts.button ?? 0,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    target: opts.noAnchor ? ({ closest: () => null } as unknown as Element) : (anchor as unknown as Element),
  } as unknown as MouseEvent;
}

describe("route progress: clicks that SHOULD start the bar", () => {
  it("an ordinary internal link to a different page", () => {
    expect(target(click("/blog"), "/shop")).toBe("/blog");
  });

  it("an absolute URL on our own origin", () => {
    expect(target(click(`${ORIGIN}/projects`), "/shop")).toBe("/projects");
  });

  it("a deeper path", () => {
    expect(target(click("/shop/p/some-product"), "/shop")).toBe("/shop/p/some-product");
  });
});

describe("route progress: clicks that must NOT start it", () => {
  it("modified clicks — the browser is opening a tab or window, not navigating us", () => {
    for (const mod of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(target(click("/blog", { [mod]: true }), "/shop"), mod).toBeNull();
    }
  });

  it("middle and right click", () => {
    expect(target(click("/blog", { button: 1 }), "/shop")).toBeNull();
    expect(target(click("/blog", { button: 2 }), "/shop")).toBeNull();
  });

  it("target=_blank and downloads", () => {
    expect(target(click("/blog", { target: "_blank" }), "/shop")).toBeNull();
    expect(target(click("/invoice.pdf", { download: true }), "/shop")).toBeNull();
  });

  it("a click something else already handled", () => {
    expect(target(click("/blog", { defaultPrevented: true }), "/shop")).toBeNull();
  });

  it("external origins", () => {
    expect(target(click("https://google.com/x"), "/shop")).toBeNull();
    expect(target(click("https://chat.metnmat.com/"), "/shop")).toBeNull();
  });

  it("non-navigational schemes", () => {
    for (const h of ["#top", "mailto:a@b.com", "tel:+919876543210"]) {
      expect(target(click(h), "/shop"), h).toBeNull();
    }
  });

  it("THE SAME page — the commonest false positive", () => {
    // The logo on the homepage, the active nav item, a breadcrumb to here.
    expect(target(click("/shop"), "/shop")).toBeNull();
    expect(target(click(`${ORIGIN}/shop`), "/shop")).toBeNull();
  });

  it("a query-only change — the shop's own transition owns that", () => {
    expect(target(click("/shop?page=2"), "/shop")).toBeNull();
    expect(target(click("/shop?sort=price"), "/shop")).toBeNull();
  });

  it("a hash-only change on the current page", () => {
    expect(target(click("/shop#results"), "/shop")).toBeNull();
  });

  it("a click that is not on a link at all", () => {
    expect(target(click("/blog", { noAnchor: true }), "/shop")).toBeNull();
  });

  it("an anchor with no href", () => {
    expect(target(click(null), "/shop")).toBeNull();
  });
});
