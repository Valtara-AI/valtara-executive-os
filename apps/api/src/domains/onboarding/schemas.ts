// Zod schemas mirroring the JSON shapes requested in
// prompts/onboarding/profile-extraction.v1.hbs,
// prompts/onboarding/voice-profile-extraction.v1.hbs, and
// prompts/onboarding/workforce-generation.v1.hbs. Used by
// completeStructured() (packages/ai-orchestrator) to validate LLM output
// before it's persisted.

import { z } from "zod";
import {
  MAX_ONBOARDING_AGENTS,
  MAX_TOPICS_OF_INTEREST,
  MIN_ONBOARDING_AGENTS,
} from "@nyxor/shared";

export const ProfileExtractionSchema = z.object({
  timeDrains: z.array(z.string()).min(1),
  delegationCandidates: z.array(z.string()).min(1),
  communicationStyle: z.string(),
  tools: z.array(z.string()),
  topicsOfInterest: z.array(z.string()).max(MAX_TOPICS_OF_INTEREST),
});
export type ProfileExtraction = z.infer<typeof ProfileExtractionSchema>;

export const VoiceProfileExtractionSchema = z.object({
  tone: z.enum(["formal", "conversational", "direct"]),
  formality: z.enum(["high", "medium", "low"]),
  sentenceLength: z.enum(["short", "medium", "long"]),
  vocabularyLevel: z.enum(["plain", "professional", "technical"]),
  salutations: z.array(z.string()),
  structuralPreferences: z.object({
    prefersBulletPoints: z.boolean(),
    prefersShortParagraphs: z.boolean(),
  }),
});
export type VoiceProfileExtraction = z.infer<typeof VoiceProfileExtractionSchema>;

// FR-OA-03: minimum 2, maximum 8 agents proposed per executive at onboarding.
export const WorkforceGenerationSchema = z.object({
  agents: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        responsibilities: z.array(z.string()).min(1),
        hitlMode: z.enum(["auto_draft_review", "checkpoint", "autonomous_report"]),
      }),
    )
    .min(MIN_ONBOARDING_AGENTS)
    .max(MAX_ONBOARDING_AGENTS),
});
export type WorkforceGeneration = z.infer<typeof WorkforceGenerationSchema>;
