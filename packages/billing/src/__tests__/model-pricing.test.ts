import { describe, expect, it } from "vitest";
import { computeCostCents, UnknownModelPricingError } from "../model-pricing.js";

describe("computeCostCents", () => {
  it("computes cost from input and output token counts at the model's published rate", () => {
    // claude-sonnet-5: $0.002/1k input, $0.01/1k output.
    const cents = computeCostCents("claude-sonnet-5", 1000, 1000);
    expect(cents).toBeCloseTo(0.2 + 1.0, 5);
  });

  it("throws UnknownModelPricingError for a model with no pricing entry, rather than defaulting to zero", () => {
    expect(() => computeCostCents("some-future-model", 1000, 1000)).toThrow(
      UnknownModelPricingError,
    );
  });
});
