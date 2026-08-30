import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./client.js";

describe("transcribeAudio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("throws if OPENAI_API_KEY is unset", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(transcribeAudio(Buffer.from("audio"), "audio/webm")).rejects.toThrow(
      /OPENAI_API_KEY/,
    );
  });

  it("sends a multipart request with the audio file and whisper-1 model", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "Hello world." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await transcribeAudio(Buffer.from("fake audio bytes"), "audio/webm");

    expect(text).toBe("Hello world.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws with the API's error message on failure", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "Invalid API key." } }),
      }),
    );

    await expect(transcribeAudio(Buffer.from("audio"), "audio/webm")).rejects.toThrow(
      /Invalid API key/,
    );
  });
});
