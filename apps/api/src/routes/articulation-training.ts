// Mounted at /api/v1/articulation-training. Executive-only throughout -
// this is self-directed coaching, not something a Delegate acts on behalf
// of the executive for (unlike briefs/personal-development, which a
// Delegate might reasonably review).

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@nyxor/database";
import { assertArticulationSessionVolume, EntitlementError } from "@nyxor/billing";
import { getSignedPlaybackUrl } from "@nyxor/integrations";
import { fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";
import { analyzeSpeech } from "../domains/articulation-training/analyze-speech.js";
import { submitAudioSession } from "../domains/articulation-training/submit-audio-session.js";

export const articulationTrainingRoute = new Hono<{ Variables: AuthedVariables }>();

articulationTrainingRoute.use("*", requireRole("Executive"));

const SESSION_TYPES = ["speech", "pitch", "presentation", "deal_close"] as const;

const SubmitTextSchema = z.object({
  sessionType: z.enum(SESSION_TYPES),
  inputText: z.string().trim().min(1).max(20_000),
});

// Audio recordings can genuinely take a while to reach 5 minutes of runtime
// even at a modest bitrate - 25MB comfortably covers that without letting
// an unbounded upload through.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

articulationTrainingRoute.post("/", async (c) => {
  const { id: executiveId } = await resolveExecutive(c.get("user"));

  try {
    await assertArticulationSessionVolume(executiveId);
  } catch (err) {
    if (err instanceof EntitlementError) return c.json(fail("ENTITLEMENT_LIMIT", err.message), 402);
    throw err;
  }

  const parsed = SubmitTextSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const session = await analyzeSpeech(
    executiveId,
    parsed.data.sessionType,
    "text",
    parsed.data.inputText,
  );
  return c.json(ok(session), 201);
});

articulationTrainingRoute.post("/audio", async (c) => {
  const { id: executiveId } = await resolveExecutive(c.get("user"));

  try {
    await assertArticulationSessionVolume(executiveId);
  } catch (err) {
    if (err instanceof EntitlementError) return c.json(fail("ENTITLEMENT_LIMIT", err.message), 402);
    throw err;
  }

  const body = await c.req.parseBody();
  const sessionTypeParse = z.enum(SESSION_TYPES).safeParse(body.sessionType);
  const file = body.audio;
  if (!sessionTypeParse.success || !(file instanceof File)) {
    return c.json(
      fail("VALIDATION_ERROR", "Expects multipart form fields 'sessionType' and 'audio'."),
      400,
    );
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return c.json(fail("VALIDATION_ERROR", "Audio recording exceeds the 25MB limit."), 400);
  }

  const audioBuffer = Buffer.from(await file.arrayBuffer());
  const session = await submitAudioSession(
    executiveId,
    sessionTypeParse.data,
    audioBuffer,
    file.type || "audio/webm",
  );
  return c.json(ok(session), 201);
});

articulationTrainingRoute.get("/", async (c) => {
  const { id: executiveId } = await resolveExecutive(c.get("user"));
  const rows = await getDb()
    .select()
    .from(schema.articulationSessions)
    .where(eq(schema.articulationSessions.executiveId, executiveId))
    .orderBy(desc(schema.articulationSessions.createdAt));
  return c.json(ok(rows));
});

articulationTrainingRoute.get("/:id", async (c) => {
  const { id: executiveId } = await resolveExecutive(c.get("user"));
  const [session] = await getDb()
    .select()
    .from(schema.articulationSessions)
    .where(
      and(
        eq(schema.articulationSessions.id, c.req.param("id")!),
        eq(schema.articulationSessions.executiveId, executiveId),
      ),
    );
  if (!session) return c.json(fail("NOT_FOUND", "Session not found."), 404);

  const playbackUrl = session.audioStoragePath
    ? await getSignedPlaybackUrl(session.audioStoragePath)
    : null;
  return c.json(ok({ ...session, playbackUrl }));
});
