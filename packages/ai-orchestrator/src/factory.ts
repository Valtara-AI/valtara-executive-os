import type { InferenceProvider } from "./types";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { GoogleProvider } from "./providers/google-provider";

// SAD §4.3 "Model routing": per-task model configuration via env vars.
export type ModelTier = "default" | "analysis" | "onboarding" | "draft";

const TIER_ENV_VAR: Record<ModelTier, string> = {
  default: "LLM_MODEL_DEFAULT",
  analysis: "LLM_MODEL_ANALYSIS",
  onboarding: "LLM_MODEL_ONBOARDING",
  draft: "LLM_MODEL_DRAFT",
};

function resolveModel(tier: ModelTier): string {
  const envVar = TIER_ENV_VAR[tier];
  const model = process.env[envVar];
  if (!model) {
    throw new Error(`${envVar} must be set (see .env.example) to use model tier "${tier}".`);
  }
  return model;
}

function buildProvider(providerName: string, model: string): InferenceProvider {
  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(model);
    case "openai":
      return new OpenAIProvider(model);
    case "google":
      return new GoogleProvider(model);
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${providerName}". Expected one of: anthropic, openai, google, mistral, groq.`,
      );
  }
}

/**
 * Returns the primary InferenceProvider for the given model tier, per
 * LLM_PROVIDER and the tier's LLM_MODEL_* env var. Not memoized across
 * calls with different tiers — each call resolves a provider instance bound
 * to that tier's model.
 */
export function getInferenceProvider(tier: ModelTier = "default"): InferenceProvider {
  const providerName = process.env.LLM_PROVIDER;
  if (!providerName) {
    throw new Error("LLM_PROVIDER must be set (see .env.example).");
  }
  return buildProvider(providerName, resolveModel(tier));
}

/**
 * Returns the secondary/failover InferenceProvider (SRS §3.3 "Failover"),
 * or undefined if LLM_PROVIDER_SECONDARY is not configured.
 */
export function getSecondaryProvider(tier: ModelTier = "default"): InferenceProvider | undefined {
  const providerName = process.env.LLM_PROVIDER_SECONDARY;
  if (!providerName) return undefined;
  return buildProvider(providerName, resolveModel(tier));
}
