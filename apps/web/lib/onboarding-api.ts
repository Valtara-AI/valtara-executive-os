// Typed wrappers over API-001 §2.3's onboarding endpoints. Shapes mirror
// apps/api/src/domains/onboarding/engine.ts's return types exactly.

import type { HitlMode } from "@vex-os/shared";
import { apiFetch } from "./api-client";

export interface StartSessionResponse {
  sessionId: string;
  question: string;
  done: boolean;
}

export interface RespondResponse {
  question: string | null;
  done: boolean;
}

export interface ProposedAgent {
  proposalId: string;
  name: string;
  description: string;
  responsibilities: string[];
  hitlMode: HitlMode;
}

export interface CompleteResponse {
  intelligenceProfileId: string;
  voiceProfileId: string;
  proposedAgents: ProposedAgent[];
}

export interface ConfirmAgentSelection {
  proposalId: string;
  name: string;
  hitlMode: HitlMode;
  active: boolean;
}

export interface ConfirmResponse {
  activatedAgents: { id: string; name: string; hitlMode: HitlMode }[];
}

export function startOnboardingSession(accessToken: string): Promise<StartSessionResponse> {
  return apiFetch("/api/v1/executive/onboarding/start", accessToken, { method: "POST" });
}

export function respondToOnboarding(
  accessToken: string,
  sessionId: string,
  response: string,
): Promise<RespondResponse> {
  return apiFetch("/api/v1/executive/onboarding/respond", accessToken, {
    method: "POST",
    body: JSON.stringify({ sessionId, response }),
  });
}

export function completeOnboarding(
  accessToken: string,
  sessionId: string,
): Promise<CompleteResponse> {
  return apiFetch("/api/v1/executive/onboarding/complete", accessToken, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function confirmOnboardingWorkforce(
  accessToken: string,
  sessionId: string,
  agents: ConfirmAgentSelection[],
): Promise<ConfirmResponse> {
  return apiFetch("/api/v1/executive/onboarding/confirm", accessToken, {
    method: "POST",
    body: JSON.stringify({ sessionId, agents }),
  });
}
