import "server-only";
import pino from "pino";

/**
 * Server logs are where error details go; users only ever see generic
 * messages. Anything that can carry a credential is redacted at the source.
 */
export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : process.env.NODE_ENV === "test" ? "silent" : "debug"),
  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "cookie",
      "*.cookie",
      "headers.cookie",
      "headers.authorization",
      "*.headers.cookie",
      "*.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
