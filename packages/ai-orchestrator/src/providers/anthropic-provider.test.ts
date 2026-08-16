import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

// Import after the mock is registered.
const { AnthropicProvider } = await import("./anthropic-provider");

describe("AnthropicProvider", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  });

  it("maps a successful response to InferenceResult", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello, executive." }],
      usage: { input_tokens: 42, output_tokens: 7 },
      model: "claude-sonnet-4-6",
    });

    const provider = new AnthropicProvider("claude-sonnet-4-6");
    const result = await provider.complete({
      systemPrompt: "You are an onboarding agent.",
      messages: [{ role: "user", content: "Hi" }],
      maxOutputTokens: 100,
    });

    expect(result.content).toBe("Hello, executive.");
    expect(result.inputTokens).toBe(42);
    expect(result.outputTokens).toBe(7);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.provider).toBe("anthropic");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        system: "You are an onboarding agent.",
        max_tokens: 100,
        temperature: 0.3,
      }),
    );
  });

  it("defaults temperature to 0.3 when not provided", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
      model: "claude-sonnet-4-6",
    });
    const provider = new AnthropicProvider("claude-sonnet-4-6");
    await provider.complete({
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 10,
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.3 }));
  });

  it("respects an explicit temperature", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
      model: "claude-sonnet-4-6",
    });
    const provider = new AnthropicProvider("claude-sonnet-4-6");
    await provider.complete({
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 10,
      temperature: 0.9,
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.9 }));
  });

  it("throws if the response contains no text block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use" }],
      usage: { input_tokens: 1, output_tokens: 1 },
      model: "claude-sonnet-4-6",
    });
    const provider = new AnthropicProvider("claude-sonnet-4-6");
    await expect(
      provider.complete({
        systemPrompt: "sys",
        messages: [{ role: "user", content: "hi" }],
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow(/no text content block/);
  });

  it("throws a clear error if ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const provider = new AnthropicProvider("claude-sonnet-4-6");
    await expect(
      provider.complete({
        systemPrompt: "sys",
        messages: [{ role: "user", content: "hi" }],
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY must be set/);
  });

  it("isAvailable reflects ANTHROPIC_API_KEY presence", async () => {
    const provider = new AnthropicProvider("claude-sonnet-4-6");
    expect(await provider.isAvailable()).toBe(true);
    delete process.env.ANTHROPIC_API_KEY;
    expect(await provider.isAvailable()).toBe(false);
  });

  it("getProviderName returns 'anthropic'", () => {
    expect(new AnthropicProvider("claude-sonnet-4-6").getProviderName()).toBe("anthropic");
  });
});
