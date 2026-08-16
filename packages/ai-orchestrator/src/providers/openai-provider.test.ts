import { describe, expect, it } from "vitest";
import { OpenAIProvider } from "./openai-provider";
import { NotImplementedError } from "../types";

describe("OpenAIProvider", () => {
  it("throws NotImplementedError from complete()", async () => {
    const provider = new OpenAIProvider("gpt-test");
    await expect(
      provider.complete({ systemPrompt: "s", messages: [], maxOutputTokens: 10 }),
    ).rejects.toThrow(NotImplementedError);
  });

  it("isAvailable reflects OPENAI_API_KEY presence, independent of complete() being unimplemented", async () => {
    const provider = new OpenAIProvider("gpt-test");
    delete process.env.OPENAI_API_KEY;
    expect(await provider.isAvailable()).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(await provider.isAvailable()).toBe(true);
    delete process.env.OPENAI_API_KEY;
  });

  it("getProviderName returns 'openai'", () => {
    expect(new OpenAIProvider("gpt-test").getProviderName()).toBe("openai");
  });
});
