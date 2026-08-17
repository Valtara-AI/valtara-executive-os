// RFC 7636 PKCE. Shared by every adapter using Authorization Code + PKCE
// (Google, Microsoft) - the verifier/challenge generation has nothing
// provider-specific about it.

import { createHash, randomBytes } from "node:crypto";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** RFC 7636 PKCE: a random verifier and its S256 challenge. */
export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}
