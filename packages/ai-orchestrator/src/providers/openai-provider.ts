// Stub implementation proving provider-agnosticism holds at the type level
// (DL-AI-001 consequence: "OpenAIProvider, GoogleProvider, and other
// InferenceProvider implementations are still built for provider-
// agnosticism, but only AnthropicProvider is exercised by default"). Not
// exercised in Sprint 1 — switching LLM_PROVIDER=openai would need this
// filled in with a real openai SDK call, at which point it becomes the
// second (and only other) file permitted to import that SDK directly.

import type { InferenceProvider, InferenceRequest, InferenceResult } from "../types";
import { NotImplementedError } from "../types";

export class OpenAIProvider implements InferenceProvider {
  constructor(private readonly model: string) {}

  async complete(_request: InferenceRequest): Promise<InferenceResult> {
    void this.model;
    throw new NotImplementedError(this.getProviderName());
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  getProviderName(): string {
    return "openai";
  }
}
