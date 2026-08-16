# Prompts

Versioned Handlebars prompt templates. CLAUDE.md: "All prompts: Handlebars templates in `/prompts/`. No inline prompt strings in business logic."

## Convention

```
prompts/<feature>/<purpose>.v<n>.hbs
```

Example: `prompts/onboarding/ask-question.v1.hbs`. Bump `n` on any change to prompt wording or structure — never edit a shipped version in place, since `TaskOutput`/onboarding records store the prompt version used for every LLM call (SAD §4.3).

## Loading

Templates are rendered via `renderPrompt(templatePath, context)` in `packages/ai-orchestrator/src/prompt-loader.ts`. Business logic never constructs prompt strings inline — it calls `renderPrompt` with a template path relative to this directory and a context object, and passes the rendered string as `systemPrompt` (or into `messages`) on an `InferenceRequest`.

## Directories

- `onboarding/` — Onboarding Agent interview, Executive Intelligence Profile extraction, Voice Profile extraction, agent workforce generation (see SRS §4.2, OA-SYS-01 through OA-SYS-04).
