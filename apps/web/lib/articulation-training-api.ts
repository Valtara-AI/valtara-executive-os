import type { ArticulationSession, ArticulationSessionType } from "@nyxor/shared";
import { apiFetch, ApiError, type ApiEnvelope } from "./api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function submitTextSession(
  accessToken: string,
  sessionType: ArticulationSessionType,
  inputText: string,
): Promise<ArticulationSession> {
  return apiFetch("/api/v1/articulation-training", accessToken, {
    method: "POST",
    body: JSON.stringify({ sessionType, inputText }),
  });
}

export function listSessions(accessToken: string): Promise<ArticulationSession[]> {
  return apiFetch("/api/v1/articulation-training", accessToken);
}

export function getSession(
  accessToken: string,
  id: string,
): Promise<ArticulationSession & { playbackUrl: string | null }> {
  return apiFetch(`/api/v1/articulation-training/${id}`, accessToken);
}

// apiFetch always sends Content-Type: application/json, which is wrong for
// a multipart upload - the browser needs to set that header itself (with
// the multipart boundary) when the body is a FormData. This is a separate,
// minimal wrapper for that one case rather than complicating apiFetch's
// JSON-only contract for every other caller.
export async function submitAudioSession(
  accessToken: string,
  sessionType: ArticulationSessionType,
  audioBlob: Blob,
): Promise<ArticulationSession> {
  const formData = new FormData();
  formData.append("sessionType", sessionType);
  formData.append("audio", audioBlob, `recording.${audioBlob.type.split("/")[1] ?? "webm"}`);

  const res = await fetch(`${API_URL}/api/v1/articulation-training/audio`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const body = (await res.json()) as ApiEnvelope<ArticulationSession>;
  if (!res.ok || !body.success) {
    throw new ApiError(
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.message ?? `Request failed with status ${res.status}.`,
      body.error?.details,
    );
  }
  return body.data as ArticulationSession;
}
