// Stub — see openai-provider.ts for the rationale. Not exercised in Sprint 1.

import type { InferenceProvider, InferenceRequest, InferenceResult } from "../types.js";
import { NotImplementedError } from "../types.js";

export class GoogleProvider implements InferenceProvider {
  constructor(private readonly model: string) {}

  async complete(_request: InferenceRequest): Promise<InferenceResult> {
    void this.model;
    throw new NotImplementedError(this.getProviderName());
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GOOGLE_AI_API_KEY);
  }

  getProviderName(): string {
    return "google";
  }
}
