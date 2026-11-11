import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_TTL_SECONDS } from "@/lib/session-cookie";

const PUBLIC_PATHS = new Set(["/login"]);

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React needs eval in development only, for its error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No upgrade-insecure-requests: the local docker run is plain http on
    // localhost, and upgrading its own requests would break it. HSTS covers
    // a real https deployment.
  ].join("; ");
}

/**
 * Two jobs, neither of them authorization:
 *  1. a fresh CSP nonce per request, which Next attaches to its scripts;
 *  2. sending a visitor with no session cookie straight to /login.
 * A cookie being present proves nothing — every page and action validates the
 * session against the database. Auth that lives only in middleware is exactly
 * what CVE-2025-29927 bypassed.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token && !PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Server Components cannot set cookies, so the session's sliding expiry is
  // mirrored onto the cookie here. The database expiry stays authoritative.
  if (token && request.method === "GET") {
    response.cookies.set(SESSION_COOKIE_NAME, token, { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS });
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
