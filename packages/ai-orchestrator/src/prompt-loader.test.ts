import { describe, expect, it } from "vitest";
import { renderPrompt } from "./prompt-loader";

describe("renderPrompt", () => {
  it("renders onboarding/ask-question.v1.hbs with an acknowledgement", async () => {
    const result = await renderPrompt("onboarding/ask-question.v1.hbs", {
      questionText: "What's your title?",
      priorAnswerAcknowledgement: "Got it, thanks.",
    });
    expect(result).toBe("Got it, thanks. What's your title?");
  });

  it("renders onboarding/ask-question.v1.hbs without an acknowledgement on the first question", async () => {
    const result = await renderPrompt("onboarding/ask-question.v1.hbs", {
      questionText: "What's your name?",
    });
    expect(result).toBe("What's your name?");
  });

  it("renders onboarding/interview-system.v1.hbs with a known executive name", async () => {
    const result = await renderPrompt("onboarding/interview-system.v1.hbs", {
      executiveName: "Jordan Ellis",
    });
    expect(result).toContain("Executive so far: Jordan Ellis");
    expect(result).toContain("VEX-OS Onboarding Agent");
  });

  it("renders onboarding/profile-extraction.v1.hbs with a transcript loop", async () => {
    const result = await renderPrompt("onboarding/profile-extraction.v1.hbs", {
      transcript: [
        { question: "What's your title?", answer: "CEO" },
        { question: "What eats your time?", answer: "Inbox triage and status updates" },
      ],
    });
    expect(result).toContain("Q: What's your title?");
    expect(result).toContain("A: CEO");
    expect(result).toContain("Q: What eats your time?");
    expect(result).toContain('"timeDrains"');
  });

  it("renders onboarding/workforce-generation.v1.hbs with joined lists", async () => {
    const result = await renderPrompt("onboarding/workforce-generation.v1.hbs", {
      profile: {
        timeDrains: ["Inbox triage", "Status updates"],
        delegationCandidates: ["Draft email replies"],
        communicationStyle: "Direct and concise.",
        tools: ["Gmail", "Slack"],
      },
    });
    expect(result).toContain("Time drains: Inbox triage, Status updates");
    expect(result).toContain("Tools: Gmail, Slack");
    expect(result).toContain("between 2 and 8 agents");
  });

  it("caches compiled templates across calls (same content each time)", async () => {
    const first = await renderPrompt("onboarding/ask-question.v1.hbs", {
      questionText: "First call",
    });
    const second = await renderPrompt("onboarding/ask-question.v1.hbs", {
      questionText: "Second call",
    });
    expect(first).toBe("First call");
    expect(second).toBe("Second call");
  });

  it("throws a clear error for a missing template", async () => {
    await expect(renderPrompt("onboarding/does-not-exist.v1.hbs", {})).rejects.toThrow();
  });
});
