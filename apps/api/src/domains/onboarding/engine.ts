// Implements SRS OA-SYS-01 through OA-SYS-04 and the onboarding endpoints
// in API-001 §2.3. See question-bank.ts for why question-asking itself is
// deterministic rather than LLM-driven.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import {
  completeStructured,
  getInferenceProvider,
  renderPrompt,
  type InferenceProvider,
} from "@nyxor/ai-orchestrator";
import { logOnboardingEvent } from "@nyxor/audit";
import type { HitlMode } from "@nyxor/shared";
import { MIN_ONBOARDING_QUESTIONS } from "@nyxor/shared";
import { FIRST_QUESTION_ID, QUESTION_BANK } from "./question-bank.js";
import {
  ProfileExtractionSchema,
  VoiceProfileExtractionSchema,
  WorkforceGenerationSchema,
} from "./schemas.js";

interface TranscriptEntry {
  question: string;
  answer: string;
}

interface SessionState {
  answers: Record<string, string>;
  transcript: TranscriptEntry[];
  currentQuestionId: string | null;
  proposedAgents?: ProposedAgent[];
}

export interface ProposedAgent {
  proposalId: string;
  name: string;
  description: string;
  responsibilities: string[];
  hitlMode: HitlMode;
}

export interface StartSessionResult {
  sessionId: string;
  question: string;
  done: boolean;
}

export interface RespondResult {
  question: string | null;
  done: boolean;
}

export interface CompleteResult {
  intelligenceProfileId: string;
  voiceProfileId: string;
  proposedAgents: ProposedAgent[];
}

export interface ConfirmAgentInput {
  proposalId: string;
  name: string;
  hitlMode: HitlMode;
  active: boolean;
}

export interface ConfirmResult {
  activatedAgents: { id: string; name: string; hitlMode: HitlMode }[];
}

const QUESTION_COUNT = Object.keys(QUESTION_BANK).length;
if (QUESTION_COUNT < MIN_ONBOARDING_QUESTIONS) {
  throw new Error(
    `QUESTION_BANK has ${QUESTION_COUNT} questions; SRS OA-SYS-01 requires at least ${MIN_ONBOARDING_QUESTIONS}.`,
  );
}

function assertState(raw: unknown): SessionState {
  const state = raw as Partial<SessionState> | null;
  return {
    answers: state?.answers ?? {},
    transcript: state?.transcript ?? [],
    currentQuestionId: state?.currentQuestionId ?? null,
    proposedAgents: state?.proposedAgents,
  };
}

export async function startSession(
  executiveId: string,
  provider: InferenceProvider = getInferenceProvider("onboarding"),
): Promise<StartSessionResult> {
  const db = getDb();
  void provider; // question-asking doesn't call the LLM; kept for interface symmetry with complete()

  const firstQuestionNode = QUESTION_BANK[FIRST_QUESTION_ID];
  if (!firstQuestionNode) {
    throw new Error(`FIRST_QUESTION_ID "${FIRST_QUESTION_ID}" not found in QUESTION_BANK.`);
  }

  const state: SessionState = {
    answers: {},
    transcript: [],
    currentQuestionId: FIRST_QUESTION_ID,
  };

  const [session] = await db
    .insert(schema.onboardingSessions)
    .values({ executiveId, state, status: "in_progress" })
    .returning();
  if (!session) throw new Error("Failed to create onboarding session.");

  const question = await renderPrompt("onboarding/ask-question.v1.hbs", {
    questionText: firstQuestionNode.questionText,
  });

  await logOnboardingEvent({
    actorId: executiveId,
    actorRole: "Executive",
    entityId: session.id,
    action: "onboarding_session_started",
  });

  return { sessionId: session.id, question, done: false };
}

export async function respond(sessionId: string, response: string): Promise<RespondResult> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(schema.onboardingSessions)
    .where(eq(schema.onboardingSessions.id, sessionId));
  if (!session) throw new Error(`Onboarding session ${sessionId} not found.`);
  if (session.status === "complete") {
    throw new Error(`Onboarding session ${sessionId} is already complete.`);
  }

  const state = assertState(session.state);
  const currentNode = state.currentQuestionId ? QUESTION_BANK[state.currentQuestionId] : undefined;
  if (!currentNode) {
    throw new Error(`Onboarding session ${sessionId} has no current question to respond to.`);
  }

  state.answers[currentNode.id] = response;
  state.transcript.push({ question: currentNode.questionText, answer: response });

  const nextQuestionId = currentNode.next(state.answers);
  state.currentQuestionId = nextQuestionId;

  await db
    .update(schema.onboardingSessions)
    .set({
      state,
      currentQuestionIndex: state.transcript.length,
      updatedAt: new Date(),
    })
    .where(eq(schema.onboardingSessions.id, sessionId));

  if (!nextQuestionId) {
    return { question: null, done: true };
  }

  const nextNode = QUESTION_BANK[nextQuestionId];
  if (!nextNode) {
    throw new Error(`Question id "${nextQuestionId}" not found in QUESTION_BANK.`);
  }

  const question = await renderPrompt("onboarding/ask-question.v1.hbs", {
    questionText: nextNode.questionText,
    priorAnswerAcknowledgement: "Got it.",
  });

  return { question, done: false };
}

export async function complete(
  sessionId: string,
  provider: InferenceProvider = getInferenceProvider("onboarding"),
): Promise<CompleteResult> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(schema.onboardingSessions)
    .where(eq(schema.onboardingSessions.id, sessionId));
  if (!session) throw new Error(`Onboarding session ${sessionId} not found.`);
  if (!session.executiveId) throw new Error(`Onboarding session ${sessionId} has no executiveId.`);

  const state = assertState(session.state);
  if (state.currentQuestionId !== null) {
    throw new Error(
      `Onboarding session ${sessionId} still has unanswered questions (current: ${state.currentQuestionId}).`,
    );
  }
  if (state.transcript.length < MIN_ONBOARDING_QUESTIONS) {
    throw new Error(
      `Onboarding session ${sessionId} has only ${state.transcript.length} answers; expected at least ${MIN_ONBOARDING_QUESTIONS} (OA-SYS-01).`,
    );
  }

  // OA-SYS-02: Executive Intelligence Profile extraction.
  const profileSystemPrompt = await renderPrompt("onboarding/profile-extraction.v1.hbs", {
    transcript: state.transcript,
  });
  const profileExtraction = await completeStructured(
    provider,
    {
      systemPrompt: profileSystemPrompt,
      messages: [{ role: "user", content: "Extract the profile now." }],
      maxOutputTokens: 1024,
    },
    ProfileExtractionSchema,
  );

  // OA-SYS-04: Voice Profile extraction.
  const voiceSystemPrompt = await renderPrompt("onboarding/voice-profile-extraction.v1.hbs", {
    transcript: state.transcript,
  });
  const voiceExtraction = await completeStructured(
    provider,
    {
      systemPrompt: voiceSystemPrompt,
      messages: [{ role: "user", content: "Extract the voice profile now." }],
      maxOutputTokens: 512,
    },
    VoiceProfileExtractionSchema,
  );

  const [intelligenceProfile] = await db
    .insert(schema.executiveIntelligenceProfiles)
    .values({
      executiveId: session.executiveId,
      timeDrains: profileExtraction.timeDrains,
      delegationCandidates: profileExtraction.delegationCandidates,
      communicationStyle: profileExtraction.communicationStyle,
      tools: profileExtraction.tools,
      topicsOfInterest: profileExtraction.topicsOfInterest,
    })
    .returning();
  if (!intelligenceProfile) throw new Error("Failed to persist ExecutiveIntelligenceProfile.");

  const [voiceProfile] = await db
    .insert(schema.voiceProfiles)
    .values({
      executiveId: session.executiveId,
      tone: voiceExtraction.tone,
      formality: voiceExtraction.formality,
      sentenceLength: voiceExtraction.sentenceLength,
      vocabularyLevel: voiceExtraction.vocabularyLevel,
      salutations: voiceExtraction.salutations,
      structuralPreferences: voiceExtraction.structuralPreferences,
    })
    .returning();
  if (!voiceProfile) throw new Error("Failed to persist VoiceProfile.");

  await db
    .update(schema.executives)
    .set({ voiceProfileId: voiceProfile.id })
    .where(eq(schema.executives.id, session.executiveId));

  // OA-SYS-03 / FR-OA-03: proposed agent workforce (2-8 agents).
  const workforceSystemPrompt = await renderPrompt("onboarding/workforce-generation.v1.hbs", {
    profile: profileExtraction,
  });
  const workforce = await completeStructured(
    provider,
    {
      systemPrompt: workforceSystemPrompt,
      messages: [{ role: "user", content: "Propose the workforce now." }],
      maxOutputTokens: 1536,
    },
    WorkforceGenerationSchema,
  );

  const proposedAgents: ProposedAgent[] = workforce.agents.map((agent) => ({
    proposalId: randomUUID(),
    ...agent,
  }));

  state.proposedAgents = proposedAgents;
  await db
    .update(schema.onboardingSessions)
    .set({ state, status: "complete", updatedAt: new Date() })
    .where(eq(schema.onboardingSessions.id, sessionId));

  await logOnboardingEvent({
    actorId: session.executiveId,
    actorRole: "Executive",
    entityId: sessionId,
    action: "onboarding_session_completed",
    output: {
      intelligenceProfileId: intelligenceProfile.id,
      voiceProfileId: voiceProfile.id,
      proposedAgentCount: proposedAgents.length,
    },
  });

  return {
    intelligenceProfileId: intelligenceProfile.id,
    voiceProfileId: voiceProfile.id,
    proposedAgents,
  };
}

export async function confirm(
  sessionId: string,
  selections: ConfirmAgentInput[],
): Promise<ConfirmResult> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(schema.onboardingSessions)
    .where(eq(schema.onboardingSessions.id, sessionId));
  if (!session) throw new Error(`Onboarding session ${sessionId} not found.`);
  if (!session.executiveId) throw new Error(`Onboarding session ${sessionId} has no executiveId.`);
  if (session.status !== "complete") {
    throw new Error(`Onboarding session ${sessionId} is not yet complete; call /complete first.`);
  }

  const state = assertState(session.state);
  const proposedById = new Map((state.proposedAgents ?? []).map((a) => [a.proposalId, a]));

  const activated: { id: string; name: string; hitlMode: HitlMode }[] = [];

  for (const selection of selections) {
    if (!selection.active) continue;
    const proposal = proposedById.get(selection.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${selection.proposalId} was not part of this onboarding session.`);
    }

    const [inserted] = await db
      .insert(schema.agents)
      .values({
        executiveId: session.executiveId,
        name: selection.name || proposal.name,
        description: proposal.description,
        responsibilities: proposal.responsibilities,
        hitlMode: selection.hitlMode,
        status: "active",
      })
      .returning();
    if (!inserted) throw new Error("Failed to persist agent.");

    activated.push({ id: inserted.id, name: inserted.name, hitlMode: inserted.hitlMode });
  }

  await db
    .update(schema.executives)
    .set({ onboardingStatus: "complete" })
    .where(eq(schema.executives.id, session.executiveId));

  await logOnboardingEvent({
    actorId: session.executiveId,
    actorRole: "Executive",
    entityId: sessionId,
    action: "onboarding_workforce_confirmed",
    output: { activatedAgentCount: activated.length },
  });

  return { activatedAgents: activated };
}
