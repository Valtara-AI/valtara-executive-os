// Zod schema mirroring the JSON shape requested in
// prompts/articulation-training/analyze-speech.v1.hbs. Used by
// completeStructured() to validate LLM output before persisting.

import { z } from "zod";

export const AnalyzeSpeechSchema = z.object({
  clarityScore: z.number().min(0).max(100),
  structureScore: z.number().min(0).max(100),
  persuasivenessScore: z.number().min(0).max(100),
  toneScore: z.number().min(0).max(100),
  fillerPhrases: z.array(z.string()),
  strengths: z.array(z.string()),
  rewriteSuggestions: z.array(
    z.object({
      original: z.string(),
      suggested: z.string(),
      reason: z.string(),
    }),
  ),
  overallFeedback: z.string(),
});
export type AnalyzeSpeechResult = z.infer<typeof AnalyzeSpeechSchema>;
