// SAD §4.4 "Common pattern": every adapter implements this. Read/write
// operations specific to a provider (listThreads, createEvent, etc.) live
// on the concrete adapter class, not here - Gmail and Calendar have too
// little in common operationally to force into one shared surface beyond
// connection lifecycle.

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
}

export interface AuthorizationRequest {
  url: string;
  /** PKCE code_verifier - the caller (route handler) must persist this (e.g. in a signed state token) to pass back into exchangeCodeForTokens on callback. */
  codeVerifier: string;
}

export interface IntegrationAdapter {
  getProviderName(): string;
  isConnected(executiveId: string): Promise<boolean>;
  /** Builds the provider consent URL the executive is redirected to. */
  getAuthorizationUrl(state: string): AuthorizationRequest;
  /** Exchanges an OAuth callback's authorization code for tokens. */
  exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokenSet>;
  /** Revokes and deletes stored tokens for this executive. */
  disconnect(executiveId: string): Promise<void>;
}

export class IntegrationNotConnectedError extends Error {
  constructor(provider: string, executiveId: string) {
    super(`Executive ${executiveId} has no connected ${provider} integration.`);
    this.name = "IntegrationNotConnectedError";
  }
}

// SEC-001 / DL-ARCH-005 concrete expression at the adapter layer: any
// method that performs a real external side effect (send email, create/
// update a calendar event) requires the caller to already hold an approved
// HITL queue item id. The adapter's job is to refuse without one and to
// record the external_actions row inside the same operation - it does not
// re-derive HITL state itself (that's hitl.ts's job); it trusts what it's
// handed but the database trigger is the actual backstop if it's wrong.
export interface HitlGatedWriteContext {
  hitlQueueItemId: string;
  agentId: string;
}
