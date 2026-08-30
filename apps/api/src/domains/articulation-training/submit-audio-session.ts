// Audio-mode entry point: upload the recording, transcribe it, then hand
// off to the same analyzeSpeech() every text-mode submission uses. Kept
// synchronous (no queue) for v1 - see this domain's route for the
// measured-latency note on when that assumption should be revisited.

import { randomUUID } from "node:crypto";
import { transcribeAudio, uploadRecording } from "@nyxor/integrations";
import type { InferenceProvider } from "@nyxor/ai-orchestrator";
import { getInferenceProvider } from "@nyxor/ai-orchestrator";
import type { ArticulationSessionType } from "@nyxor/shared";
import { analyzeSpeech } from "./analyze-speech.js";

export async function submitAudioSession(
  executiveId: string,
  sessionType: ArticulationSessionType,
  audioBuffer: Buffer,
  mimeType: string,
  provider: InferenceProvider = getInferenceProvider("default"),
) {
  const sessionId = randomUUID();

  const [{ path }, transcript] = await Promise.all([
    uploadRecording(executiveId, sessionId, audioBuffer, mimeType),
    transcribeAudio(audioBuffer, mimeType),
  ]);

  return analyzeSpeech(executiveId, sessionType, "audio", transcript, provider, {
    audioStoragePath: path,
  });
}
