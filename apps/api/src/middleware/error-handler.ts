// API-001 §2.1: error responses are always {success:false, error:{code,
// message, details?}}. SEC-001 §5: "No stack traces in production API
// responses; errors logged internally with full context."

import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { fail } from "@vex-os/shared";
import { logger } from "../logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(fail("HTTP_ERROR", err.message), err.status);
  }

  logger.error({ err: err.message, stack: err.stack }, "Unhandled error");

  const isProduction = process.env.NODE_ENV === "production";
  return c.json(
    fail(
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
      isProduction ? undefined : { message: err.message },
    ),
    500,
  );
};
