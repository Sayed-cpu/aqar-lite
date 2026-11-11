import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "@/server/auth/session";

describe("session tokens", () => {
  it("are 32 random bytes, base64url-encoded, and do not repeat", () => {
    const tokens = Array.from({ length: 200 }, generateSessionToken);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("are stored as a sha256 hex digest that never equals the token", () => {
    const token = generateSessionToken();
    const id = hashSessionToken(token);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toBe(token);
    expect(hashSessionToken(token)).toBe(id);
  });
});
