// Full startSession -> respond (xN) -> complete -> confirm flow against a
// live Postgres, with a MockProvider standing in for the LLM so this test
// is deterministic and needs no API key. Requires a live Postgres with
// migrations applied (same DB-gating pattern as
// packages/database/src/__tests__/external-action-trigger.test.ts).

import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import { MockProvider } from "@vex-os/ai-orchestrator";
import { FIRST_QUESTION_ID, QUESTION_BANK } from "./question-bank.js";
import * as engine from "./engine.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("onboarding engine end-to-end", () => {
  // getDb() throws if DATABASE_URL is unset, so it must stay inside a
  // beforeAll/it callback (lazy, skipped along with the tests) rather than
  // the describe body itself (which vitest always executes during
  // collection, even under skipIf).
  let db: ReturnType<typeof getDb>;
  let executiveId: string;

  afterAll(async () => {
    if (executiveId) {
      await db.delete(schema.executives).where(eq(schema.executives.id, executiveId));
    }
  });

  it("walks the full question graph, then extracts profiles and proposes a workforce", async () => {
    db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Test Exec", email: `onboarding-test-${Date.now()}@example.com` })
      .returning();
    executiveId = executive!.id;

    const provider = new MockProvider();
    const { sessionId, question: firstQuestion } = await engine.startSession(executiveId, provider);
    expect(firstQuestion).toContain(QUESTION_BANK[FIRST_QUESTION_ID]!.questionText);

    // Walk the leadership branch (title -> "CEO") to completion.
    const answersInOrder = [
      "Jordan Ellis", // name
      "CEO", // title -> branches to top_level_decision
      "Approving the annual budget allocation across departments.", // top_level_decision
      "Technology / SaaS", // domain
      "Acme Corp", // organization
      "Triaging my inbox every morning.", // time_drain_1
      "Preparing weekly status decks for the board.", // time_drain_2
      "Scheduling and rescheduling meetings.", // time_drain_3
      "Inbox triage, definitely — it's constant and low-judgment.", // delegation_candidate
      "Gmail, Google Calendar, Slack.", // tools
      "Short and direct.", // communication_style
      "Team, quick update: shipped the v2 API today, on track for Friday's release.", // voice_sample
      "Close the Q3 enterprise deal and finish the Series B deck.", // priorities
    ];

    let done = false;
    for (const answer of answersInOrder) {
      const result = await engine.respond(sessionId, answer);
      done = result.done;
    }
    expect(done).toBe(true);

    provider.enqueue(
      JSON.stringify({
        timeDrains: ["Inbox triage", "Status decks", "Scheduling"],
        delegationCandidates: ["Draft inbox triage summaries", "Draft weekly status decks"],
        communicationStyle: "Short and direct.",
        tools: ["Gmail", "Google Calendar", "Slack"],
      }),
      JSON.stringify({
        tone: "direct",
        formality: "medium",
        sentenceLength: "short",
        vocabularyLevel: "professional",
        salutations: ["Team,"],
        structuralPreferences: { prefersBulletPoints: true, prefersShortParagraphs: true },
      }),
      JSON.stringify({
        agents: [
          {
            name: "Inbox Triage Agent",
            description: "Drafts summaries and replies for routine inbox items.",
            responsibilities: ["Summarize unread threads", "Draft replies for approval"],
            hitlMode: "auto_draft_review",
          },
          {
            name: "Board Deck Agent",
            description: "Drafts the weekly status deck from task/agent activity.",
            responsibilities: ["Compile weekly status", "Draft deck outline"],
            hitlMode: "checkpoint",
          },
        ],
      }),
    );

    const completeResult = await engine.complete(sessionId, provider);
    expect(completeResult.proposedAgents).toHaveLength(2);
    expect(completeResult.proposedAgents[0]?.name).toBe("Inbox Triage Agent");

    const [persistedProfile] = await db
      .select()
      .from(schema.executiveIntelligenceProfiles)
      .where(eq(schema.executiveIntelligenceProfiles.id, completeResult.intelligenceProfileId));
    expect(persistedProfile?.tools).toEqual(["Gmail", "Google Calendar", "Slack"]);

    const confirmResult = await engine.confirm(sessionId, [
      {
        proposalId: completeResult.proposedAgents[0]!.proposalId,
        name: "Inbox Triage Agent",
        hitlMode: "auto_draft_review",
        active: true,
      },
      {
        proposalId: completeResult.proposedAgents[1]!.proposalId,
        name: "Board Deck Agent",
        hitlMode: "checkpoint",
        active: false, // executive declines this one
      },
    ]);

    expect(confirmResult.activatedAgents).toHaveLength(1);
    expect(confirmResult.activatedAgents[0]?.name).toBe("Inbox Triage Agent");

    const [updatedExecutive] = await db
      .select()
      .from(schema.executives)
      .where(eq(schema.executives.id, executiveId));
    expect(updatedExecutive?.onboardingStatus).toBe("complete");

    const persistedAgents = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.executiveId, executiveId));
    expect(persistedAgents).toHaveLength(1);
  });
});
