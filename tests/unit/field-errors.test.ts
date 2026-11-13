import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toFieldErrors } from "@/server/actions/create-action";

describe("toFieldErrors", () => {
  it("keys messages by field and omits fields that passed", () => {
    const schema = z.strictObject({
      name: z.string().min(2, { error: "قصير" }),
      phone: z.string(),
    });
    const result = schema.safeParse({ name: "a", phone: "0500000000" });
    if (result.success) throw new Error("expected a validation failure");
    expect(toFieldErrors(result.error)).toEqual({ name: ["قصير"] });
  });
});
