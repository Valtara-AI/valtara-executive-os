import { describe, expect, it } from "vitest";
import { GoogleProvider } from "./google-provider.js";
import { NotImplementedError } from "../types.js";

describe("GoogleProvider", () => {
  it("throws NotImplementedError from complete()", async () => {
    const provider = new GoogleProvider("gemini-test");
    await expect(
      provider.complete({ systemPrompt: "s", messages: [], maxOutputTokens: 10 }),
    ).rejects.toThrow(NotImplementedError);
  });

  it("isAvailable reflects GOOGLE_AI_API_KEY presence", async () => {
    const provider = new GoogleProvider("gemini-test");
    delete process.env.GOOGLE_AI_API_KEY;
    expect(await provider.isAvailable()).toBe(false);
    process.env.GOOGLE_AI_API_KEY = "test-key";
    expect(await provider.isAvailable()).toBe(true);
    delete process.env.GOOGLE_AI_API_KEY;
  });

  it("getProviderName returns 'google'", () => {
    expect(new GoogleProvider("gemini-test").getProviderName()).toBe("google");
  });
});
