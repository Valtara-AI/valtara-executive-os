// SRS §3.3: "All LLM responses validated for structure before use;
// malformed responses trigger retry with backoff (max 3 attempts)."
// SAD §4.3: "Schema validation (Zod) on structured LLM responses; retry
// with clarifying prompt on validation failure; max 3 retries before task
// marked failed."

import type { ZodType } from "zod";
import { MAX_LLM_RESPONSE_RETRIES } from "@nyxor/shared";
import type { InferenceProvider, InferenceRequest } from "./types.js";

export class ResponseValidationError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = "ResponseValidationError";
  }
}

/**
 * Calls provider.complete with responseFormat "json", parses and validates
 * the result against `schema`. On parse/validation failure, retries with a
 * clarifying follow-up message describing the error, up to
 * MAX_LLM_RESPONSE_RETRIES attempts total.
 */
export async function completeStructured<T>(
  provider: InferenceProvider,
  request: Omit<InferenceRequest, "responseFormat">,
  schema: ZodType<T>,
): Promise<T> {
  const messages = [...request.messages];
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_LLM_RESPONSE_RETRIES; attempt++) {
    const result = await provider.complete({
      ...request,
      messages,
      responseFormat: "json",
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      lastError = "Response was not valid JSON.";
      messages.push(
        { role: "assistant", content: result.content },
        {
          role: "user",
          content: `Your last response was not valid JSON: ${lastError} Reply again with only valid JSON matching the requested schema.`,
        },
      );
      continue;
    }

    const validation = schema.safeParse(parsed);
    if (validation.success) {
      return validation.data;
    }

    lastError = validation.error.message;
    messages.push(
      { role: "assistant", content: result.content },
      {
        role: "user",
        content: `Your last response did not match the required schema: ${lastError} Reply again with only valid JSON matching the requested schema.`,
      },
    );
  }

  throw new ResponseValidationError(
    `LLM response failed schema validation after ${MAX_LLM_RESPONSE_RETRIES} attempts: ${lastError}`,
    MAX_LLM_RESPONSE_RETRIES,
  );
}
