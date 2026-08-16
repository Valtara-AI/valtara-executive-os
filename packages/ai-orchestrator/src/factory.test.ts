import { afterEach, describe, expect, it } from "vitest";
import { getInferenceProvider, getSecondaryProvider } from "./factory.js";
import { AnthropicProvider } from "./providers/anthropic-provider.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getInferenceProvider", () => {
  it("returns an AnthropicProvider when LLM_PROVIDER=anthropic", () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_MODEL_DEFAULT = "claude-sonnet-4-6";
    const provider = getInferenceProvider("default");
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.getProviderName()).toBe("anthropic");
  });

  it("resolves the model from the tier-specific env var", () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_MODEL_ONBOARDING = "claude-sonnet-4-6";
    delete process.env.LLM_MODEL_DEFAULT;
    expect(() => getInferenceProvider("onboarding")).not.toThrow();
  });

  it("throws a clear error when LLM_PROVIDER is unset", () => {
    delete process.env.LLM_PROVIDER;
    expect(() => getInferenceProvider("default")).toThrow(/LLM_PROVIDER must be set/);
  });

  it("throws a clear error for an unrecognized provider", () => {
    process.env.LLM_PROVIDER = "not-a-real-provider";
    process.env.LLM_MODEL_DEFAULT = "whatever";
    expect(() => getInferenceProvider("default")).toThrow(/Unknown LLM_PROVIDER/);
  });

  it("throws a clear error when the tier's model env var is unset", () => {
    process.env.LLM_PROVIDER = "anthropic";
    delete process.env.LLM_MODEL_ANALYSIS;
    expect(() => getInferenceProvider("analysis")).toThrow(/LLM_MODEL_ANALYSIS must be set/);
  });
});

describe("getSecondaryProvider", () => {
  it("returns undefined when LLM_PROVIDER_SECONDARY is unset", () => {
    delete process.env.LLM_PROVIDER_SECONDARY;
    expect(getSecondaryProvider("default")).toBeUndefined();
  });

  it("returns a provider instance when LLM_PROVIDER_SECONDARY is set", () => {
    process.env.LLM_PROVIDER_SECONDARY = "anthropic";
    process.env.LLM_MODEL_DEFAULT = "claude-sonnet-4-6";
    expect(getSecondaryProvider("default")).toBeInstanceOf(AnthropicProvider);
  });
});
