// Loader for the /prompts convention (see prompts/README.md). Business
// logic never constructs prompt strings inline — it calls renderPrompt with
// a template path relative to the repo's /prompts directory.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

const moduleDir = dirname(fileURLToPath(import.meta.url));
// packages/ai-orchestrator/src -> repo root /prompts
const PROMPTS_ROOT = resolve(moduleDir, "../../../prompts");

const compiledTemplateCache = new Map<string, HandlebarsTemplateDelegate>();

async function getCompiledTemplate(templateRelPath: string): Promise<HandlebarsTemplateDelegate> {
  const cached = compiledTemplateCache.get(templateRelPath);
  if (cached) return cached;

  const filePath = join(PROMPTS_ROOT, templateRelPath);
  const source = await readFile(filePath, "utf8");
  const compiled = Handlebars.compile(source, { noEscape: true, strict: true });
  compiledTemplateCache.set(templateRelPath, compiled);
  return compiled;
}

/**
 * Renders a Handlebars prompt template from /prompts.
 * @param templateRelPath path relative to /prompts, e.g. "onboarding/ask-question.v1.hbs"
 */
export async function renderPrompt(
  templateRelPath: string,
  context: Record<string, unknown>,
): Promise<string> {
  const template = await getCompiledTemplate(templateRelPath);
  return template(context).trim();
}
