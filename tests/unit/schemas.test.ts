import { describe, expect, it } from "vitest";
import { auditListQuerySchema } from "@/lib/schemas/audit";
import { loginInputSchema } from "@/lib/schemas/auth";

describe("login input", () => {
  it("normalises the email", () => {
    const parsed = loginInputSchema.parse({ email: "  Manager@Ofuq.TEST ", password: "x" });
    expect(parsed.email).toBe("manager@ofuq.test");
  });

  it("rejects fields it does not define", () => {
    const result = loginInputSchema.safeParse({ email: "a@b.test", password: "x", role: "manager" });
    expect(result.success).toBe(false);
  });

  it("caps the password so it cannot become expensive Argon2 work", () => {
    expect(loginInputSchema.safeParse({ email: "a@b.test", password: "x".repeat(129) }).success).toBe(false);
  });

  it("rejects a non-string value such as an uploaded file", () => {
    expect(loginInputSchema.safeParse({ email: "a@b.test", password: null }).success).toBe(false);
  });
});

describe("audit list query", () => {
  it("drops unknown keys, including a smuggled companyId", () => {
    const parsed = auditListQuerySchema.parse({ page: "2", companyId: "someone-else" });
    expect(parsed).toEqual({ page: 2, pageSize: 20 });
  });

  it("falls back to defaults for values out of range or not numbers", () => {
    expect(auditListQuerySchema.parse({ page: "abc", pageSize: "1000" })).toEqual({ page: 1, pageSize: 20 });
    expect(auditListQuerySchema.parse({ page: "-3", pageSize: "0" })).toEqual({ page: 1, pageSize: 20 });
  });
});
