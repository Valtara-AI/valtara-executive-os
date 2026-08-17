// Called by apps/web's NextAuth jwt callback (via the internal
// /api/v1/internal/resolve-role endpoint) at sign-in time to decide what
// role a brand-new session gets minted with. Every prior sign-up hardcoded
// "Executive" - nothing could ever become a Delegate through the actual
// auth flow, which made the Delegate role entirely theoretical regardless
// of what RBAC or the schema allowed.
//
// Precedence, evaluated in order:
//  1. The email is in ADMIN_EMAILS -> "Administrator". Checked first,
//     ahead of any Executive/Delegate row, because this is an explicit
//     operator-controlled allowlist (DL-SEC-002) rather than something the
//     product itself ever grants - nothing in-app can add or remove an
//     entry, so a match here always reflects an intentional deployment
//     decision, not incidental account history.
//  2. An Executive row already exists for this email -> "Executive".
//     Takes priority over Delegate so an existing executive who's also
//     been invited as someone else's delegate keeps their own identity in
//     this session (a single JWT carries one role - see the module
//     comment in resolve-accessible-executive-ids.ts for what that does
//     and doesn't cover).
//  3. A delegate_links row (pending or accepted - inviting them is enough
//     to shape their sign-in experience even before they've accepted)
//     exists for this email -> "Delegate".
//  4. None of the above -> "Executive" (unchanged default for a genuinely
//     new user).

import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import type { Role } from "@vex-os/shared";
import { normalizeEmail } from "./invite-delegate.js";

function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((entry) => normalizeEmail(entry.trim()))
    .filter(Boolean)
    .includes(email);
}

export async function resolveRoleForEmail(rawEmail: string): Promise<Role> {
  const email = normalizeEmail(rawEmail);

  if (isAdminEmail(email)) return "Administrator";

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
