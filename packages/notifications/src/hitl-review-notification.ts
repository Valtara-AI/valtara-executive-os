// Closes the "poll the dashboard to find out" gap: fires when
// execute-task.ts creates a hitl_queue_items row for auto_draft_review or
// checkpoint mode (autonomous_report never creates one - see
// task-complete-notification.ts for that mode's notification instead).

import { sendEmail, type SendEmailResult } from "./send-email.js";

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export async function sendHitlReviewNotification(params: {
  to: string;
  executiveName: string;
  agentName: string;
  taskPrompt: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: `${params.agentName} has something for you to review`,
    html: `
      <p>Hi ${escapeHtml(params.executiveName)},</p>
      <p><strong>${escapeHtml(params.agentName)}</strong> completed a task and is waiting on your review:</p>
      <p style="padding:12px;border-left:3px solid #ccc;color:#555;">${escapeHtml(params.taskPrompt)}</p>
      <p>Review it in your NYXOR HITL queue.</p>
    `.trim(),
  });
}
