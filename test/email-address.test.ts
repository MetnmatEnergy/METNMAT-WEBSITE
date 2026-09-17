import { describe, it, expect } from "vitest";
import {
  emailSyntaxOk,
  emailDomain,
  emailLimitKey,
} from "../apps/website/src/backend/lib/email-address";

/**
 * The enquiry validator's regex accepts anything shaped `x@y.z`. That is the
 * right bar for filing an enquiry and the wrong bar for sending mail to it: the
 * 2026-09-03/04 relay abuse passed it with addresses that then bounced. This
 * check decides whether an auto-reply is attempted at all.
 */
describe("emailSyntaxOk", () => {
  it("accepts ordinary and slightly unusual real addresses", () => {
    for (const ok of [
      "jane@lab.example",
      "first.last@sub.company.co.in",
      "user+tag@gmail.com",
      "o'neil@irish.ie",
      "x_y-z@a-b.io",
      "UPPER@CASE.COM",
      "a@b.cd",
      "研究@xn--fiqs8s.cn".replace("研究", "yanjiu"), // punycode TLD form
    ]) {
      expect(emailSyntaxOk(ok), ok).toBe(true);
    }
  });

  it("is still only SYNTAX: the bounced addresses from the incident are well-formed", () => {
    // This is why the domain check exists — see email-mx.ts.
    expect(emailSyntaxOk("FS@JFOWI.COM")).toBe(true);
  });

  it("rejects what the loose validator lets through", () => {
    for (const bad of [
      "",
      "fbdfbdf",
      "no-at.com",
      "two@@at.com",
      "user@localhost",
      "user@.com",
      "user@com.",
      ".dot@first.com",
      "dot..dot@x.com",
      "user@-hyphen.com",
      "user@hyphen-.com",
      "user@x.123",
      "user@x.c",
      "user @space.com",
      "user@x.com\nbcc@evil.example",
      '"quoted"@x.com',
      "a".repeat(65) + "@x.com",
      "user@" + "a".repeat(64) + ".com",
      "u@" + "a.".repeat(130) + "com",
    ]) {
      expect(emailSyntaxOk(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects non-strings rather than throwing", () => {
    for (const v of [null, undefined, 42, {}, []]) expect(emailSyntaxOk(v)).toBe(false);
  });
});

describe("emailDomain", () => {
  it("lower-cases the domain", () => {
    expect(emailDomain("Jane@Lab.Example")).toBe("lab.example");
  });
  it("is null without a usable domain", () => {
    expect(emailDomain("nope")).toBeNull();
    expect(emailDomain("x@")).toBeNull();
  });
});

describe("emailLimitKey", () => {
  it("folds case and plus-tags, so one mailbox is one bucket", () => {
    expect(emailLimitKey("Jane+news@Lab.Example")).toBe("jane@lab.example");
    expect(emailLimitKey("a+b+c@x.com")).toBe("a@x.com");
    expect(emailLimitKey("  jane@lab.example ")).toBe("jane@lab.example");
  });
  it("leaves a leading plus alone (there is no local part before it)", () => {
    expect(emailLimitKey("+lead@x.com")).toBe("+lead@x.com");
  });
});
