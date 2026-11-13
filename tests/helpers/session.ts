import type { SessionUser } from "@/server/auth/session";
import type { TestUser } from "./db";

/** What getCurrentSession() would return for a fixture user. */
export function sessionOf(user: TestUser): SessionUser {
  return {
    sessionId: "0".repeat(64),
    userId: user.id,
    companyId: user.companyId,
    companyName: "—",
    role: user.role,
    name: user.name,
    email: user.email,
    expiresAt: new Date(Date.now() + 60_000),
  };
}
