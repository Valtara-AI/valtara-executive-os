import { afterEach, describe, expect, it } from "vitest";
import { getTierPriceId, tierForPriceId } from "../tiers.js";

describe("tiers", () => {
  afterEach(() => {
    delete process.env.STRIPE_PRICE_ID_STARTER;
    delete process.env.STRIPE_PRICE_ID_PRO;
    delete process.env.STRIPE_PRICE_ID_ENTERPRISE;
  });

  it("getTierPriceId reads the matching env var", () => {
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_123";
    expect(getTierPriceId("pro")).toBe("price_pro_123");
  });

  it("getTierPriceId throws when the env var isn't set", () => {
    expect(() => getTierPriceId("enterprise")).toThrow(/STRIPE_PRICE_ID_ENTERPRISE/);
  });

  it("tierForPriceId resolves a price id back to its tier", () => {
    process.env.STRIPE_PRICE_ID_STARTER = "price_starter_123";
    expect(tierForPriceId("price_starter_123")).toBe("starter");
  });

  it("tierForPriceId throws for an unrecognized price id", () => {
    process.env.STRIPE_PRICE_ID_STARTER = "price_starter_123";
    expect(() => tierForPriceId("price_unknown")).toThrow(/does not match/);
  });
});
