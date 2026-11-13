import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { unitFilterErrors, unitListQuerySchema } from "@/lib/schemas/units";
import { submitForm } from "@/server/actions/form";

class Redirected extends Error {}
const redirectTo = (data: { id: string }): never => {
  throw new Redirected(data.id);
};

function recorder(result: ActionResult<{ id: string }>) {
  return vi.fn(async (_input: unknown) => result);
}

describe("submitForm", () => {
  it("passes the form's fields on, without React's $ACTION bookkeeping", async () => {
    const form = new FormData();
    form.append("$ACTION_ID_abc123", "");
    form.append("$ACTION_REF_1", "");
    form.append("name", "سامي");
    form.append("phone", "0551234567");
    const action = recorder({ ok: true, data: { id: "u1" } });

    await expect(submitForm(form, action, redirectTo)).rejects.toThrow(Redirected);
    expect(action).toHaveBeenCalledWith({ name: "سامي", phone: "0551234567" });
  });

  it("passes on fields nobody asked for, so the schema refuses them instead of ignoring them", async () => {
    const form = new FormData();
    form.append("name", "سامي");
    form.append("ownerUserId", "someone-else");
    form.append("__proto__", "polluted");
    const action = recorder({ ok: false, error: { code: "VALIDATION", message: "تحقق" } });

    await submitForm(form, action, redirectTo);
    const input = action.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(input).sort()).toEqual(["__proto__", "name", "ownerUserId"]);
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
  });

  it("turns a repeated field into an array, which no string field accepts", async () => {
    const form = new FormData();
    form.append("price", "1");
    form.append("price", "2");
    const action = recorder({ ok: false, error: { code: "VALIDATION", message: "تحقق" } });

    await submitForm(form, action, redirectTo);
    expect(action).toHaveBeenCalledWith({ price: ["1", "2"] });
  });

  it("returns the error and the typed values, so the form keeps them", async () => {
    const form = new FormData();
    form.append("$ACTION_KEY", "k");
    form.append("price", "abc");
    const action = recorder({
      ok: false,
      error: { code: "VALIDATION", message: "تحقق من البيانات المدخلة", fieldErrors: { price: ["خطأ"] } },
    });

    expect(await submitForm(form, action, redirectTo)).toEqual({
      message: "تحقق من البيانات المدخلة",
      fieldErrors: { price: ["خطأ"] },
      values: { price: "abc" },
    });
  });

  it("refuses a call that does not carry form data at all", async () => {
    const action = recorder({ ok: true, data: { id: "u1" } });
    const state = await submitForm({ name: "x" }, action, redirectTo);
    expect(state.message).toBeDefined();
    expect(action).not.toHaveBeenCalled();
  });
});

describe("unitFilterErrors", () => {
  const errorsFor = (raw: Record<string, string>) => unitFilterErrors(raw, unitListQuerySchema.parse(raw));

  it("says nothing for blank or readable filters", () => {
    expect(errorsFor({ minPrice: "", maxPrice: "٥٠٠٠٠٠" })).toEqual({});
  });

  it("flags a price filter it had to ignore", () => {
    expect(errorsFor({ minPrice: "abc" })).toEqual({ minPrice: [expect.any(String)] });
  });

  it("flags a range whose top is under its bottom", () => {
    expect(errorsFor({ minPrice: "500000", maxPrice: "400000" })).toEqual({ maxPrice: [expect.any(String)] });
  });
});
