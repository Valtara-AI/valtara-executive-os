// Deliberately NOT an IntegrationAdapter - same reasoning as
// ../market-data/client.ts and ../news/client.ts: this is a single
// platform API key, not per-executive OAuth. Uses OpenAI's
// /v1/audio/transcriptions endpoint (Whisper) via plain fetch, NOT the
// `openai` npm package - no OpenAI SDK dependency anywhere in this repo.
//
// This is not a CLAUDE.md "model agnostic" violation: that rule governs
// swappable LLM *completion* calls behind InferenceProvider (the
// LLM_PROVIDER env var). Transcription has no completion/chat surface -
// it's a distinct capability, same category as the market-data/news
// clients, sitting entirely outside that abstraction. Reuses the same
// OPENAI_API_KEY placeholder already in .env.example (there for a future
// OpenAI InferenceProvider, currently unimplemented per DL-AI-001) since
// it's the same underlying platform credential, just used for a different
// API surface here.
//
// DL-AI-003: transcribing to text (discarding pacing/pauses/tone) rather
// than native multimodal audio analysis was a deliberate choice, not an
// oversight - see that entry for why native analysis wasn't realistic
// given AnthropicProvider is the only real InferenceProvider today and
// Claude has no audio-input modality to call.

import { fetchWithBackoff } from "../http-retry.js";

const WHISPER_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

interface WhisperResponse {
  text?: string;
  error?: { message: string };
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY must be set (see .env.example).");
  return key;
}

/**
 * Transcribes an audio recording to text via OpenAI's Whisper API.
 * `mimeType` determines the filename extension sent in the multipart body
 * (Whisper infers format from the extension, not a separate field).
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = getApiKey();
  const extension = mimeType.split("/")[1] ?? "webm";

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), `recording.${extension}`);
  form.append("model", "whisper-1");

  const res = await fetchWithBackoff(WHISPER_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const body = (await res.json()) as WhisperResponse;
  if (!res.ok || !body.text) {
    throw new Error(`Whisper transcription failed: ${body.error?.message ?? res.status}`);
  }

  return body.text;
}
