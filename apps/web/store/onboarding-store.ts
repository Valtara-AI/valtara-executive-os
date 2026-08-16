import { create } from "zustand";
import type { HitlMode } from "@vex-os/shared";
import type { ProposedAgent } from "@/lib/onboarding-api";

export interface ChatMessage {
  role: "agent" | "user";
  text: string;
}

export interface AgentSelection {
  proposalId: string;
  name: string;
  hitlMode: HitlMode;
  active: boolean;
}

export type OnboardingPhase = "interviewing" | "reviewing_workforce" | "confirmed";

interface OnboardingState {
  sessionId: string | null;
  phase: OnboardingPhase;
  messages: ChatMessage[];
  proposedAgents: ProposedAgent[];
  selections: Record<string, AgentSelection>;

  startInterview: (sessionId: string, firstQuestion: string) => void;
  addUserAnswer: (text: string) => void;
  addAgentQuestion: (text: string) => void;
  beginWorkforceReview: (agents: ProposedAgent[]) => void;
  updateSelection: (proposalId: string, patch: Partial<AgentSelection>) => void;
  confirmComplete: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  phase: "interviewing" as OnboardingPhase,
  messages: [],
  proposedAgents: [],
  selections: {},
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  startInterview: (sessionId, firstQuestion) =>
    set({
      sessionId,
      phase: "interviewing",
      messages: [{ role: "agent", text: firstQuestion }],
    }),

  addUserAnswer: (text) =>
    set((state) => ({ messages: [...state.messages, { role: "user", text }] })),

  addAgentQuestion: (text) =>
    set((state) => ({ messages: [...state.messages, { role: "agent", text }] })),

  beginWorkforceReview: (agents) =>
    set({
      phase: "reviewing_workforce",
      proposedAgents: agents,
      selections: Object.fromEntries(
        agents.map((agent) => [
          agent.proposalId,
          {
            proposalId: agent.proposalId,
            name: agent.name,
            hitlMode: agent.hitlMode,
            active: true,
          },
        ]),
      ),
    }),

  updateSelection: (proposalId, patch) =>
    set((state) => ({
      selections: {
        ...state.selections,
        [proposalId]: { ...state.selections[proposalId]!, ...patch },
      },
    })),

  confirmComplete: () => set({ phase: "confirmed" }),

  reset: () => set(initialState),
}));
