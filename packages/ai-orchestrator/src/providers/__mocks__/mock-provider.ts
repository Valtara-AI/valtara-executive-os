// Deterministic mock used by tests (onboarding engine, factory) so CI never
// needs a real ANTHROPIC_API_KEY. Not wired into the factory's env-driven
// selection — tests construct it directly.

import type { InferenceProvider, InferenceRequest, InferenceResult } from "../../types.js";

export class MockProvider implements InferenceProvider {
  /** Queue of responses to return in order; falls back to `defaultResponse` once exhausted. */
  private queue: string[] = [];
  public readonly calls: InferenceRequest[] = [];

  constructor(private readonly defaultResponse = "{}") {}

  enqueue(...responses: string[]): void {
    this.queue.push(...responses);
  }

  async complete(request: InferenceRequest): Promise<InferenceResult> {
    this.calls.push(request);
    const content = this.queue.shift() ?? this.defaultResponse;
    return {
      content,
      inputTokens: request.systemPrompt.length,
      outputTokens: content.length,
      model: "mock-model",
      provider: this.getProviderName(),
      latencyMs: 1,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getProviderName(): string {
    return "mock";
  }
}
