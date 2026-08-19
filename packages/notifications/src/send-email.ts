// Resend's own SDK returns { data, error } rather than throwing on a
// delivery failure (invalid recipient, rate limit, etc.) - this wrapper
// preserves that non-throwing contract so callers (execute-task.ts) can
// treat a failed notification as "log and continue," never as a reason to
// fail the task itself. It still throws if RESEND_API_KEY isn't
// configured at all - that's a real misconfiguration, not a delivery
// failure, same distinction getStripeClient()/getInferenceProvider() draw.

import { getEmailClient, getFromAddress } from "./email-client.js";

export interface SendEmailResult {
  error: string | null;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const resend = getEmailClient();
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });
  return { error: error ? error.message : null };
}
