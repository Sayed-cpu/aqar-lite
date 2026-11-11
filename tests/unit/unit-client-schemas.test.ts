import { describe, expect, it } from "vitest";
import { clientInputSchema, clientListQuerySchema, clientUpdateSchema } from "@/lib/schemas/clients";
import { unitInputSchema, unitListQuerySchema, unitUpdateSchema } from "@/lib/schemas/units";

const validUnit = {
  project: " أبراج الياسمين ",
  number: "A-101",
  type: "apartment",
  areaSqm: "١٢٠٫٥",
  rooms: "3",
  price: "1,250,000.50",
};

describe("unit input", () => {
  it("normalises what a person types into exact values", () => {
    expect(unitInputSchema.parse(validUnit)).toEqual({
      project: "أبراج الياسمين",
      number: "A-101",
      type: "apartment",
      areaSqm: "120.5",
      rooms: 3,
      price: 125_000_050n,
    });
  });

  it("refuses a status or a company — the fields a manager must not set", () => {
    expect(unitInputSchema.safeParse({ ...validUnit, status: "sold" }).success).toBe(false);
    expect(unitUpdateSchema.safeParse({ ...validUnit, id: crypto.randomUUID(), companyId: crypto.randomUUID() }).success).toBe(
      false,
    );
  });

  it.each([
    ["price", "0"],
    ["price", "-10"],
    ["price", "12.345"],
    ["areaSqm", "0"],
    ["areaSqm", "abc"],
    ["rooms", "2.5"],
    ["rooms", "51"],
    ["type", "castle"],
    ["project", " "],
  ])("rejects %s = %j with a message on that field", (field, value) => {
    const result = unitInputSchema.safeParse({ ...validUnit, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});

describe("unit list query", () => {
  it("parses filters, sort and page from URL strings", () => {
    expect(
      unitListQuerySchema.parse({ status: "available", minPrice: "500000", maxPrice: "1500000.5", sort: "price_desc", page: "2" }),
    ).toEqual({
      status: "available",
      minPrice: 50_000_000n,
      maxPrice: 150_000_050n,
      sort: "price_desc",
      page: 2,
      pageSize: 20,
    });
  });

  it("treats blank or unparseable filters as no filter, and drops unknown keys", () => {
    expect(
      unitListQuerySchema.parse({ status: "", minPrice: "lots", maxPrice: "1;drop table units", sort: "price; --", companyId: "x" }),
    ).toEqual({ status: undefined, minPrice: undefined, maxPrice: undefined, sort: "newest", page: 1, pageSize: 20 });
  });

  it("ignores a status that is repeated or not one of the three", () => {
    expect(unitListQuerySchema.parse({ status: ["available", "sold"] }).status).toBeUndefined();
    expect(unitListQuerySchema.parse({ status: "deleted" }).status).toBeUndefined();
  });
});

describe("client input", () => {
  const validClient = { name: "محمد الغامدي", phone: "٠٥٠ ١٢٣-٤٥٦٧", notes: "  يفضّل الدور الأرضي  " };

  it("normalises the phone and trims the notes", () => {
    expect(clientInputSchema.parse(validClient)).toEqual({
      name: "محمد الغامدي",
      phone: "0501234567",
      notes: "يفضّل الدور الأرضي",
    });
  });

  it("refuses an owner — a client belongs to whoever adds it", () => {
    expect(clientInputSchema.safeParse({ ...validClient, ownerUserId: crypto.randomUUID() }).success).toBe(false);
    expect(clientUpdateSchema.safeParse({ ...validClient, id: crypto.randomUUID(), ownerUserId: "x" }).success).toBe(false);
  });

  it("keeps notes as text, markup included, and caps their length", () => {
    expect(clientInputSchema.parse({ ...validClient, notes: "<script>alert(1)</script>" }).notes).toBe(
      "<script>alert(1)</script>",
    );
    expect(clientInputSchema.safeParse({ ...validClient, notes: "x".repeat(2001) }).success).toBe(false);
  });

  it.each(["12345", "05-abc-123", "+9665012345678901"])("rejects the phone %j", (phone) => {
    expect(clientInputSchema.safeParse({ ...validClient, phone }).success).toBe(false);
  });
});

describe("client list query", () => {
  it("caps the search term and treats a blank one as none", () => {
    expect(clientListQuerySchema.parse({ q: "  " }).q).toBeUndefined();
    expect(clientListQuerySchema.parse({ q: "x".repeat(101) }).q).toBeUndefined();
    expect(clientListQuerySchema.parse({ q: " فهد " }).q).toBe("فهد");
  });
});
