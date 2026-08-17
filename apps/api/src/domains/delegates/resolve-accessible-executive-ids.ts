// Role-aware authorization boundary used by routes that allow both
// Executive and Delegate access (hitl.ts, tasks.ts's read routes). An
// Executive can only ever access their own data; a Delegate can access
// every executive that has an *accepted* (not merely pending) link to
// their email - PRD §3.2's "reviews agent outputs on behalf of the
// executive" only makes sense once that relationship is confirmed on both
// sides. Administrator explicitly gets none (SEC-001 §3.2: "no access to
// executive content").

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import type { JwtPayload } from "@vex-os/shared";
import { resolveExecutive } from "../onboarding/resolve-executive.js";
import { normalizeEmail } from "./invite-delegate.js";

export async function resolveAccessibleExecutiveIds(user: JwtPayload): Promise<string[]> {
  if (user.role === "Executive") {
    const executive = await resolveExecutive(user);
    return [executive.id];
  }

  if (user.role === "Delegate") {
    const links = await getDb()
      .select({ executiveId: schema.delegateLinks.executiveId })
      .from(schema.delegateLinks)
      .where(
        and(
          eq(schema.delegateLinks.delegateEmail, normalizeEmail(user.email)),
          eq(schema.delegateLinks.status, "accepted"),
        ),
      );
    return links.map((l) => l.executiveId);
  }

  return [];
}
