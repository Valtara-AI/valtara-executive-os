// CLAUDE.md: "Logging: Pino JSON only. No console.log in production code.
// No PII in logs." This is the only logger instance in apps/api — route
// handlers and middleware import this rather than using console.*.

import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  formatters: {
    level: (label) => ({ level: label }),
  },
});
