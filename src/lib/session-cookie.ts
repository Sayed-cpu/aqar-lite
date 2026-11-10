// Shared by the server and proxy.ts, which must not import database code.

export const SESSION_COOKIE_NAME = "aqar_session";

/** Sliding: renewed on use; see SESSION_RENEW_THRESHOLD_MS in the server. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // Browsers treat http://localhost as a secure context, so this still works
  // for a local docker compose run.
  secure: true,
  // Lax keeps the cookie off cross-site POSTs (CSRF) without breaking a
  // normal link into the app.
  sameSite: "lax",
  path: "/",
} as const;
