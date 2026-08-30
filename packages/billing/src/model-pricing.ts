// Cost governance (DL-ARCH-014) needs a $/token rate per model to turn
// taskOutputs' tokensInput/tokensOutput into real spend. This table is a
// manually-maintained snapshot of published provider pricing - it will go
// stale as providers change prices and drifts further every time a new
// model ships. Review it whenever a new LLM_MODEL_* value is adopted or a
// provider announces a price change; there is no API to fetch this
// automatically.
//
// Rates confirmed against Anthropic's published pricing (August 2026):
// Opus 5 $5/$25 per million input/output tokens, Sonnet 5 $2/$10
// (introductory, through 2026-08-31; $3/$15 standard from 2026-09-01),
// Haiku 4.5 $1/$5, Fable 5 $10/$50. OpenAI/Google model IDs aren't priced
// here yet - NYXOR-DL-001's LLM_PROVIDER default is Anthropic and no
// pilot customer has configured another provider so far.

export interface ModelRate {
  /** USD cents per 1,000 input tokens. */
  inputCentsPerThousand: number;
  /** USD cents per 1,000 output tokens. */
  outputCentsPerThousand: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  "claude-opus-5": { inputCentsPerThousand: 0.5, outputCentsPerThousand: 2.5 },
  "claude-sonnet-5": { inputCentsPerThousand: 0.2, outputCentsPerThousand: 1.0 },
  "claude-haiku-4-5-20251001": { inputCentsPerThousand: 0.1, outputCentsPerThousand: 0.5 },
  "claude-fable-5": { inputCentsPerThousand: 1.0, outputCentsPerThousand: 5.0 },
};

export class UnknownModelPricingError extends Error {
  constructor(modelId: string) {
    super(
      `No pricing entry for model "${modelId}" in packages/billing/src/model-pricing.ts - add one before this model can be used, so cost governance can't silently undercount spend.`,
    );
    this.name = "UnknownModelPricingError";
  }
}

/**
 * Computes USD cents for one task output. Throws rather than defaulting to
 * zero for an unrecognized model - treating an unpriced model as free
 * would silently defeat the whole point of a cost cap.
 */
export function computeCostCents(
  modelId: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const rate = MODEL_RATES[modelId];
  if (!rate) throw new UnknownModelPricingError(modelId);
  return (
    (tokensInput / 1000) * rate.inputCentsPerThousand +
    (tokensOutput / 1000) * rate.outputCentsPerThousand
  );
}
