import { describe, expect, it } from "vitest";
import { FIRST_QUESTION_ID, QUESTION_BANK, type QuestionNode } from "./question-bank.js";
import { MIN_ONBOARDING_QUESTIONS } from "@vex-os/shared";

function walk(answers: Record<string, string>): string[] {
  const visited: string[] = [];
  let currentId: string | null = FIRST_QUESTION_ID;
  let guard = 0;
  while (currentId) {
    if (++guard > 50) throw new Error("Question graph appears to loop.");
    visited.push(currentId);
    const node: QuestionNode | undefined = QUESTION_BANK[currentId];
    if (!node) throw new Error(`Missing question node "${currentId}".`);
    currentId = node.next(answers);
  }
  return visited;
}

describe("QUESTION_BANK", () => {
  it("has at least MIN_ONBOARDING_QUESTIONS entries (OA-SYS-01)", () => {
    expect(Object.keys(QUESTION_BANK).length).toBeGreaterThanOrEqual(MIN_ONBOARDING_QUESTIONS);
  });

  it("every node's id matches its key in the bank", () => {
    for (const [key, node] of Object.entries(QUESTION_BANK)) {
      expect(node.id).toBe(key);
    }
  });

  it("every next() target (other than null) exists in the bank", () => {
    const dummyAnswers = { title: "CEO" };
    for (const node of Object.values(QUESTION_BANK)) {
      const nextId = node.next(dummyAnswers);
      if (nextId !== null) {
        expect(QUESTION_BANK[nextId], `next id "${nextId}" from "${node.id}"`).toBeDefined();
      }
    }
  });

  it("branches to top_level_decision for a leadership title", () => {
    const path = walk({ title: "Founder & CEO" });
    expect(path).toContain("top_level_decision");
    expect(path).not.toContain("accountability_area");
  });

  it("branches to accountability_area for a functional-leadership title", () => {
    const path = walk({ title: "VP of Sales" });
    expect(path).toContain("accountability_area");
    expect(path).not.toContain("top_level_decision");
  });

  it("both branches converge and complete with at least MIN_ONBOARDING_QUESTIONS questions", () => {
    const leadershipPath = walk({ title: "Managing Partner" });
    const functionalPath = walk({ title: "Director of Engineering" });
    expect(leadershipPath.length).toBeGreaterThanOrEqual(MIN_ONBOARDING_QUESTIONS);
    expect(functionalPath.length).toBeGreaterThanOrEqual(MIN_ONBOARDING_QUESTIONS);
    // Same total length: one branch question either way, converging immediately after.
    expect(leadershipPath.length).toBe(functionalPath.length);
  });

  it("terminates (reaches a node whose next() returns null)", () => {
    const path = walk({ title: "CFO" });
    const lastNode = QUESTION_BANK[path[path.length - 1] as string];
    expect(lastNode?.next({})).toBeNull();
  });
});
