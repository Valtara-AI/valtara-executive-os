// Thin fetch wrapper for calling apps/api. Every authenticated call needs
// the RS256 access token minted in auth.ts's session callback - callers
// pass it explicitly rather than this module reaching into next-auth
// itself, so it works identically from client components (useSession) and
// server components/actions (auth()).

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  const body = (await res.json()) as ApiEnvelope<T>;

  // `data: null` is a legitimate *success* payload for endpoints like
  // GET /briefs/today ("null if not yet generated" - API-001 §2.7), not
  // itself a failure signal - res.ok + body.success are the actual
  // contract for that (API-001 §2.1).
  if (!res.ok || !body.success) {
    throw new ApiError(
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.message ?? `Request to ${path} failed with status ${res.status}.`,
      body.error?.details,
    );
  }

  return body.data as T;
}
