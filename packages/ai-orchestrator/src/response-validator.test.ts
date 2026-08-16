import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockProvider } from "./providers/__mocks__/mock-provider.js";
import { completeStructured, ResponseValidationError } from "./response-validator.js";

const PersonSchema = z.object({ name: z.string(), age: z.number() });

describe("completeStructured", () => {
  it("returns validated data on the first attempt", async () => {
    const provider = new MockProvider();
    provider.enqueue(JSON.stringify({ name: "Ada", age: 30 }));

    const result = await completeStructured(
      provider,
      { systemPrompt: "sys", messages: [{ role: "user", content: "go" }], maxOutputTokens: 100 },
      PersonSchema,
    );

    expect(result).toEqual({ name: "Ada", age: 30 });
    expect(provider.calls).toHaveLength(1);
  });

  it("retries on invalid JSON and succeeds on the second attempt", async () => {
    const provider = new MockProvider();
    provider.enqueue("not json at all", JSON.stringify({ name: "Ada", age: 30 }));

    const result = await completeStructured(
      provider,
      { systemPrompt: "sys", messages: [{ role: "user", content: "go" }], maxOutputTokens: 100 },
      PersonSchema,
    );

    expect(result).toEqual({ name: "Ada", age: 30 });
    expect(provider.calls).toHaveLength(2);
  });

  it("retries on schema mismatch and succeeds on a later attempt", async () => {
    const provider = new MockProvider();
    provider.enqueue(
      JSON.stringify({ name: "Ada" }), // missing age
      JSON.stringify({ name: "Ada", age: "not a number" }), // wrong type
      JSON.stringify({ name: "Ada", age: 30 }), // valid
    );

    const result = await completeStructured(
      provider,
      { systemPrompt: "sys", messages: [{ role: "user", content: "go" }], maxOutputTokens: 100 },
      PersonSchema,
    );

    expect(result).toEqual({ name: "Ada", age: 30 });
    expect(provider.calls).toHaveLength(3);
  });

  it("throws ResponseValidationError after exhausting retries (max 3 attempts)", async () => {
    const provider = new MockProvider("still not valid json");

    await expect(
      completeStructured(
        provider,
        { systemPrompt: "sys", messages: [{ role: "user", content: "go" }], maxOutputTokens: 100 },
        PersonSchema,
      ),
    ).rejects.toThrow(ResponseValidationError);

    expect(provider.calls).toHaveLength(3);
  });

  it("sets responseFormat: 'json' on every call", async () => {
    const provider = new MockProvider();
    provider.enqueue(JSON.stringify({ name: "Ada", age: 30 }));

    await completeStructured(
      provider,
      { systemPrompt: "sys", messages: [{ role: "user", content: "go" }], maxOutputTokens: 100 },
      PersonSchema,
    );

    expect(provider.calls[0]?.responseFormat).toBe("json");
  });
});
