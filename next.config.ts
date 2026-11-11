import type { NextConfig } from "next";

// Pages get their nonce-based Content-Security-Policy from src/proxy.ts;
// these apply to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Ignored by browsers over plain http, so harmless for the local run.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage.
  output: "standalone",
  poweredByHeader: false,
  // Every page here is per-user and behind a session, so there is nothing to
  // prerender; Cache Components would only add rules about where cookies() may
  // be read, and the nonce CSP needs dynamic rendering anyway.
  cacheComponents: false,
  // Native/stream-based packages must stay as runtime requires, not bundled.
  serverExternalPackages: ["@node-rs/argon2", "pg", "pino"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses are JSON and never a document: allow nothing.
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }],
      },
    ];
  },
};

export default nextConfig;
