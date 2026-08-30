// Exact shape from NYXOR-API-001 §4.1. This is the sole contract every LLM
// call in NYXOR goes through (CLAUDE.md non-negotiable #1: MODEL AGNOSTIC).

export interface InferenceRequest {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxOutputTokens: number;
  /** default: 0.3 for agents; 0.7 for creative tasks */
  temperature?: number;
  responseFormat?: "text" | "json";
}

export interface InferenceResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface InferenceProvider {
  complete(request: InferenceRequest): Promise<InferenceResult>;
  isAvailable(): Promise<boolean>;
  getProviderName(): string;
}

export class NotImplementedError extends Error {
  constructor(providerName: string) {
    super(
      `${providerName} is not implemented in Sprint 1. It exists to prove provider-agnosticism holds at the type level (DL-AI-001) — Anthropic is the only active default.`,
    );
    this.name = "NotImplementedError";
  }
}
