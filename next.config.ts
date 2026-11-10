import type { NextConfig } from "next";

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
};

export default nextConfig;
