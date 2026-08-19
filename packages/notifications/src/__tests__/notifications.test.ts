// Mocks email-client.ts's getEmailClient() rather than hitting Resend's
// real API - no real account/API key needed, same rationale as every
// other adapter's mocked-fetch test in this codebase. Proves two things:
// HTML-escaping actually happens (a task prompt or agent name containing
// user-controlled text shouldn't be able to inject markup into the
// email), and a Resend-reported delivery failure surfaces as a result
// field, never a thrown exception - that's what lets execute-task.ts treat
// a notification failure as "log and continue."

import { afterEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("../email-client.js", () => ({
  getEmailClient: () => ({ emails: { send: sendMock } }),
  getFromAddress: () => "VEX-OS <notifications@vex-os.example>",
}));

const { sendHitlReviewNotification } = await import("../hitl-review-notification.js");
const { sendTaskCompleteNotification } = await import("../task-complete-notification.js");

describe("notifications", () => {
  afterEach(() => {
    sendMock.mockReset();
  });

  it("sendHitlReviewNotification escapes HTML in the task prompt", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null });

    await sendHitlReviewNotification({
      to: "exec@example.com",
      executiveName: "Jordan Ellis",
      agentName: "Inbox Triage",
      taskPrompt: '<script>alert("x")</script>',
    });

    const html = sendMock.mock.calls[0]![0].html as string;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sendTaskCompleteNotification returns the error field rather than throwing on delivery failure", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "invalid recipient", name: "validation_error" },
    });

    const result = await sendTaskCompleteNotification({
      to: "not-an-email",
      executiveName: "Jordan Ellis",
      agentName: "Board Relations",
      taskPrompt: "Prepare memo",
      outputText: "Done.",
    });

    expect(result.error).toBe("invalid recipient");
  });

  it("sendHitlReviewNotification returns error: null on success", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_2" }, error: null });

    const result = await sendHitlReviewNotification({
      to: "exec@example.com",
      executiveName: "Jordan Ellis",
      agentName: "Inbox Triage",
      taskPrompt: "Draft a reply",
    });

    expect(result.error).toBeNull();
  });
});
