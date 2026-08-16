// The one file in the repo permitted to import @anthropic-ai/sdk directly
// (see the ESLint no-restricted-imports carve-out in eslint.config.js).
// Every other call site must go through packages/ai-orchestrator's
// InferenceProvider interface (CLAUDE.md non-negotiable #1).

import Anthropic from "@anthropic-ai/sdk";
import type { InferenceProvider, InferenceRequest, InferenceResult } from "../types.js";

export class AnthropicProvider implements InferenceProvider {
  private client: Anthropic | undefined;

  // InferenceRequest (API-001 §4.1) has no "model" field — model-tier
  // selection (LLM_MODEL_DEFAULT / _ANALYSIS / _ONBOARDING / _DRAFT, per
  // SAD §4.3) happens at construction time via the factory, not per-call.
  constructor(private readonly model: string) {}

  private getClient(): Anthropic {
    if (this.client) return this.client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY must be set (see .env.example).");
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  async complete(request: InferenceRequest): Promise<InferenceResult> {
    const start = Date.now();

    const response = await this.getClient().messages.create({
      model: this.model,
      system: request.systemPrompt,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: request.maxOutputTokens,
      temperature: request.temperature ?? 0.3,
    });

    const latencyMs = Date.now() - start;

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textBlock) {
      throw new Error("Anthropic response contained no text content block.");
    }

    return {
      content: textBlock.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
      provider: this.getProviderName(),
      latencyMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  getProviderName(): string {
    return "anthropic";
  }
}
