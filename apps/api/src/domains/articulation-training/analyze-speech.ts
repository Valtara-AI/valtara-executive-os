// Purely internal feedback (shown only to its own author, never sent
// externally) - never touches external_actions, no backing agent, no
// Task/HITL pipeline. Same category as generate-brief.ts/
// generate-recommendations.ts: a platform-level domain function, not
// delegable work. Shared entry point for BOTH input modes - text mode
// calls this directly with the executive's typed input; audio mode
// transcribes first (see submit-audio-session.ts) and calls this with the
// transcript, so this function itself never branches on inputMode.
//
// Because audio arrives here as a transcript, not a signal, toneScore and
// fillerPhrases are judged from word choice/phrasing alone - actual vocal
// delivery (pacing, pauses, tone-of-voice) is not analyzed. DL-AI-003
// covers why (transcribe-then-text vs. native multimodal audio) and what
// would need to be true to revisit it.

import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import {
  completeStructured,
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@nyxor/ai-orchestrator";
import { logTaskEvent } from "@nyxor/audit";
import type { ArticulationSessionType, ArticulationInputMode } from "@nyxor/shared";
import { AnalyzeSpeechSchema } from "./schemas.js";

export class ExecutiveNotFoundError extends Error {
  constructor(executiveId: string) {
    super(`Executive ${executiveId} not found.`);
    this.name = "ExecutiveNotFoundError";
  }
}

export interface AnalyzeSpeechOptions {
  audioStoragePath?: string;
  audioDurationSeconds?: number;
}

export async function analyzeSpeech(
  executiveId: string,
  sessionType: ArticulationSessionType,
  inputMode: ArticulationInputMode,
  inputText: string,
  provider: InferenceProvider = getInferenceProvider("default"),
  options: AnalyzeSpeechOptions = {},
) {
  const db = getDb();

  const [executive] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.id, executiveId));
  if (!executive) throw new ExecutiveNotFoundError(executiveId);

  const systemPrompt = await renderPrompt("articulation-training/analyze-speech.v1.hbs", {
    executiveName: executive.name,
    sessionType,
    inputText,
    isTranscript: inputMode === "audio",
  });

  const result = await completeStructured(
    provider,
    {
      systemPrompt,
      messages: [{ role: "user", content: "Analyze this now." }],
      maxOutputTokens: 1536,
    },
    AnalyzeSpeechSchema,
  );

  const [session] = await db
    .insert(schema.articulationSessions)
    .values({
      executiveId,
      sessionType,
      inputMode,
      inputText,
      audioStoragePath: options.audioStoragePath,
      audioDurationSeconds: options.audioDurationSeconds,
      feedbackJson: result,
      clarityScore: result.clarityScore,
      structureScore: result.structureScore,
      persuasivenessScore: result.persuasivenessScore,
      toneScore: result.toneScore,
    })
    .returning();
  if (!session) throw new Error("Failed to persist articulation session.");

  await logTaskEvent({
    actorId: executive.id,
    actorRole: "Executive",
    entityType: "articulation_session",
    entityId: session.id,
    action: "articulation_session_analyzed",
    output: {
      sessionType,
      inputMode,
      clarityScore: result.clarityScore,
      structureScore: result.structureScore,
      persuasivenessScore: result.persuasivenessScore,
      toneScore: result.toneScore,
    },
  });

  return session;
}
