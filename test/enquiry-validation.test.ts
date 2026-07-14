import { describe, it, expect } from "vitest";
import { validateEnquiry } from "../apps/website/src/backend/validation";

const good = {
  name: "Jane Researcher",
  email: "jane@lab.example",
  message: "Interested in reference electrodes for a CO2 reduction rig.",
};

describe("validateEnquiry", () => {
  it("accepts a well-formed enquiry", () => {
    const r = validateEnquiry(good, "contact");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("jane@lab.example");
      expect(r.data.source).toBe("contact");
    }
  });

  it("rejects missing/invalid core fields", () => {
    const r = validateEnquiry({ name: "x", email: "not-an-email", message: "" }, "contact");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.fields.name).toBeTruthy();
      expect(r.fields.email).toBeTruthy();
      expect(r.fields.message).toBeTruthy();
    }
  });

  it("rejects a filled honeypot (bot) before validating anything else", () => {
    const r = validateEnquiry({ ...good, hp_company_url: "http://spam.example" }, "contact");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fields._rejected).toBeTruthy();
  });

  it("ignores an absent or empty honeypot (real users never fill it)", () => {
    expect(validateEnquiry({ ...good, hp_company_url: "" }, "quote").success).toBe(true);
    expect(validateEnquiry(good, "quote").success).toBe(true);
  });
});
