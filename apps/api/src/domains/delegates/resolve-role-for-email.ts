// Called by apps/web's NextAuth jwt callback (via the internal
// /api/v1/internal/resolve-role endpoint) at sign-in time to decide what
// role a brand-new session gets minted with. Every prior sign-up hardcoded
// "Executive" - nothing could ever become a Delegate through the actual
// auth flow, which made the Delegate role entirely theoretical regardless
// of what RBAC or the schema allowed.
//
// Precedence, evaluated in order:
//  1. An Executive row already exists for this email -> "Executive".
//     Takes priority so an existing executive who's also been invited as
//     someone else's delegate keeps their own identity in this session
//     (a single JWT carries one role - see the module comment in
//     resolve-accessible-executive-ids.ts for what that does and doesn't
//     cover).
//  2. A delegate_links row (pending or accepted - inviting them is enough
//     to shape their sign-in experience even before they've accepted)
//     exists for this email -> "Delegate".
//  3. Neither -> "Executive" (unchanged default for a genuinely new user).

import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import type { Role } from "@vex-os/shared";
import { normalizeEmail } from "./invite-delegate.js";

export async function resolveRoleForEmail(rawEmail: string): Promise<Role> {
  const email = normalizeEmail(rawEmail);
  const db = getDb();

  const [executive] = await db
    .select({ id: schema.executives.id })
    .from(schema.executives)
    .where(eq(schema.executives.email, email));
  if (executive) return "Executive";

  const [delegateLink] = await db
    .select({ id: schema.delegateLinks.id })
    .from(schema.delegateLinks)
    .where(eq(schema.delegateLinks.delegateEmail, email));
  if (delegateLink) return "Delegate";

  return "Executive";
}
