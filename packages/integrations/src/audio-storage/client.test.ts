import { afterEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
      })),
    },
  })),
}));

describe("audio-storage client", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
  });

  it("throws if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are unset", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { uploadRecording } = await import("./client.js");

    await expect(
      uploadRecording("exec-1", "session-1", Buffer.from("audio"), "audio/webm"),
    ).rejects.toThrow(/SUPABASE_URL/);
  });

  it("uploads to a path keyed by executiveId/sessionId.<ext> and returns the path, not a URL", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    uploadMock.mockResolvedValue({ error: null });
    const { uploadRecording } = await import("./client.js");

    const result = await uploadRecording("exec-1", "session-1", Buffer.from("audio"), "audio/webm");

    expect(result).toEqual({ path: "exec-1/session-1.webm" });
    expect(uploadMock).toHaveBeenCalledWith(
      "exec-1/session-1.webm",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "audio/webm", upsert: false }),
    );
  });

  it("throws when the upload itself fails", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    uploadMock.mockResolvedValue({ error: { message: "bucket not found" } });
    const { uploadRecording } = await import("./client.js");

    await expect(
      uploadRecording("exec-1", "session-1", Buffer.from("audio"), "audio/webm"),
    ).rejects.toThrow(/bucket not found/);
  });

  it("generates a signed playback URL for a stored path", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example.com/x" },
      error: null,
    });
    const { getSignedPlaybackUrl } = await import("./client.js");

    const url = await getSignedPlaybackUrl("exec-1/session-1.webm");
    expect(url).toBe("https://signed.example.com/x");
  });
});
