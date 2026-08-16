// OA-SYS-01: minimum 12 discovery questions, stateful, with branching logic
// based on the role/domain response. Every question maps to a specific
// field on ExecutiveIntelligenceProfile or VoiceProfile so the interview is
// provably complete against those schemas (see the "field" property below).
//
// The question flow itself is deterministic — no LLM call is made to ask a
// question (see prompts/onboarding/ask-question.v1.hbs for why). The LLM is
// used only afterward, to extract structured profiles from the full
// transcript and to generate the proposed agent workforce.

export interface QuestionNode {
  id: string;
  questionText: string;
  /** Which downstream profile field this answer primarily informs. */
  field: string;
  /** Returns the next question id given all answers collected so far, or null if this is the last question. */
  next: (answers: Record<string, string>) => string | null;
}

const EXECUTIVE_TITLE_LEADERSHIP_PATTERN =
  /\b(ceo|founder|president|managing partner|principal|executive director)\b/i;

export const QUESTION_BANK: Record<string, QuestionNode> = {
  name: {
    id: "name",
    questionText: "To start, what's your full name?",
    field: "executive.name",
    next: () => "title",
  },
  title: {
    id: "title",
    questionText: "What's your title or role?",
    field: "executive.title",
    next: (answers) =>
      EXECUTIVE_TITLE_LEADERSHIP_PATTERN.test(answers.title ?? "")
        ? "top_level_decision"
        : "accountability_area",
  },
  // Branch A: top-of-org leadership (CEO/Founder/President/Managing Partner/etc.)
  top_level_decision: {
    id: "top_level_decision",
    questionText:
      "What's the single biggest thing you personally decide that no one else in your organization can decide for you?",
    field: "intelligenceProfile.communicationStyle",
    next: () => "domain",
  },
  // Branch B: functional leadership (VP/Director/CFO/etc.)
  accountability_area: {
    id: "accountability_area",
    questionText: "What area of the business are you most directly accountable for right now?",
    field: "intelligenceProfile.communicationStyle",
    next: () => "domain",
  },
  domain: {
    id: "domain",
    questionText: "What industry or domain does your organization operate in?",
    field: "executive.domain",
    next: () => "organization",
  },
  organization: {
    id: "organization",
    questionText: "What's the name of your organization?",
    field: "executive.organization",
    next: () => "time_drain_1",
  },
  time_drain_1: {
    id: "time_drain_1",
    questionText:
      "What's the single activity that eats the most of your week that you wish you didn't have to do yourself?",
    field: "intelligenceProfile.timeDrains",
    next: () => "time_drain_2",
  },
  time_drain_2: {
    id: "time_drain_2",
    questionText:
      "What's a second recurring task or type of work that drains your time but doesn't require your unique judgment?",
    field: "intelligenceProfile.timeDrains",
    next: () => "time_drain_3",
  },
  time_drain_3: {
    id: "time_drain_3",
    questionText:
      "Is there a third thing, even a small one, that repeatedly pulls your attention away from higher-value work?",
    field: "intelligenceProfile.timeDrains",
    next: () => "delegation_candidate",
  },
  delegation_candidate: {
    id: "delegation_candidate",
    questionText:
      "If you could hand off any one of those to a capable assistant starting today, which would you choose first, and why?",
    field: "intelligenceProfile.delegationCandidates",
    next: () => "tools",
  },
  tools: {
    id: "tools",
    questionText:
      "What tools or platforms do you rely on day to day, e.g. email, calendar, CRM, messaging?",
    field: "intelligenceProfile.tools",
    next: () => "communication_style",
  },
  communication_style: {
    id: "communication_style",
    questionText:
      "How would you describe your communication style: short and direct, or more detailed and thorough?",
    field: "voiceProfile.tone",
    next: () => "voice_sample",
  },
  voice_sample: {
    id: "voice_sample",
    questionText:
      "Write two or three sentences as if you were updating your team on a project's status, just as you'd naturally write it.",
    field: "voiceProfile.sentenceLength",
    next: () => "priorities",
  },
  priorities: {
    id: "priorities",
    questionText:
      "Looking at the next quarter, what's the one or two priorities that everything else should take a back seat to?",
    field: "intelligenceProfile.delegationCandidates",
    next: () => null,
  },
};

export const FIRST_QUESTION_ID = "name";
