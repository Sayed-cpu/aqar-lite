import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("uses Argon2id with the OWASP baseline parameters", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(hash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await verifyPassword(hash, "s3cret-pass")).toBe(true);
    expect(await verifyPassword(hash, "s3cret-pasS")).toBe(false);
  });

  it("treats a malformed stored hash as a failed verification, not a crash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});
