// First real consumer of SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY -
// .env.example has carried these since before this feature existed, but
// nothing in the codebase used them until now. Uses the service-role key
// server-side only (never exposed to the browser) since this is a private,
// per-executive recording, not a public asset.
//
// The bucket is PRIVATE (not public), so there is no permanent "url" to
// hand out at upload time - only a storage path. Playback access is
// granted via a short-lived signed URL generated on demand (see
// getSignedPlaybackUrl), not a URL persisted once and reused forever,
// which would either be a public link (wrong - defeats "private") or a
// signed link that quietly expires and breaks (also wrong).

import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "articulation-recordings";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour - long enough for one playback session

let cachedClient: ReturnType<typeof createClient> | undefined;

function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set (see .env.example).",
    );
  }

  cachedClient = createClient(url, serviceRoleKey);
  return cachedClient;
}

/**
 * Uploads a practice-session recording to private storage, keyed by
 * executiveId/sessionId.<ext> so recordings are naturally namespaced per
 * executive without needing a separate ownership check at the storage
 * layer. Returns the storage path (not a URL) - persist this, not a
 * signed URL, since signed URLs expire.
 */
export async function uploadRecording(
  executiveId: string,
  sessionId: string,
  audioBuffer: Buffer,
  mimeType: string,
): Promise<{ path: string }> {
  const extension = mimeType.split("/")[1] ?? "webm";
  const path = `${executiveId}/${sessionId}.${extension}`;

  const { error } = await getSupabaseClient()
    .storage.from(BUCKET_NAME)
    .upload(path, audioBuffer, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`Failed to upload recording to Supabase Storage: ${error.message}`);
  }

  return { path };
}

/** Generates a time-limited signed URL for playback of a stored recording. */
export async function getSignedPlaybackUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data) {
    throw new Error(`Failed to create signed playback URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
