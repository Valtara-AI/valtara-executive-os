// Fires for autonomous_report agents specifically - the one HITL mode
// where execute-task.ts never creates a hitl_queue_items row (the output
// is auto-approved), so without this the executive would have no signal
// at all that the task ran. Matches CLAUDE.md's own description of that
// mode: "Agent executes fully -> completion report delivered to
// dashboard -> executive reviews outcome" - this email is that delivery.

import { sendEmail, type SendEmailResult } from "./send-email.js";

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export async function sendTaskCompleteNotification(params: {
  to: string;
  executiveName: string;
  agentName: string;
  taskPrompt: string;
  outputText: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: `${params.agentName} finished: ${params.taskPrompt.slice(0, 60)}`,
    html: `
      <p>Hi ${escapeHtml(params.executiveName)},</p>
      <p><strong>${escapeHtml(params.agentName)}</strong> finished this task autonomously:</p>
      <p style="padding:12px;border-left:3px solid #ccc;color:#555;">${escapeHtml(params.taskPrompt)}</p>
      <p><strong>Result:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(params.outputText)}</p>
    `.trim(),
  });
}
