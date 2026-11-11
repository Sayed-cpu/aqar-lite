import { drizzle } from "drizzle-orm/node-postgres";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import type { Role } from "@/lib/roles";
import { hashPassword } from "@/server/auth/password";
import { companies, users } from "@/server/db/schema";

// Local runs read .env; in docker the variables come from compose.
if (existsSync(".env")) process.loadEnvFile(".env");

/** Demo data for evaluation only — documented in the README. */
export const DEMO_PASSWORD = "Aqar@2026!";

const SEED: { company: string; users: { email: string; name: string; role: Role }[] }[] = [
  {
    company: "شركة الأفق للتطوير العقاري",
    users: [
      { email: "manager@ofuq.test", name: "خالد العتيبي", role: "manager" },
      { email: "accountant@ofuq.test", name: "سارة القحطاني", role: "accountant" },
      { email: "rep1@ofuq.test", name: "فهد الشمري", role: "sales_rep" },
      { email: "rep2@ofuq.test", name: "نورة الدوسري", role: "sales_rep" },
    ],
  },
  {
    company: "شركة المدار العقارية",
    users: [
      { email: "manager@madar.test", name: "عبدالله الحربي", role: "manager" },
      { email: "accountant@madar.test", name: "ريم الزهراني", role: "accountant" },
      { email: "rep1@madar.test", name: "ماجد المطيري", role: "sales_rep" },
      { email: "rep2@madar.test", name: "هند السبيعي", role: "sales_rep" },
    ],
  },
];

async function main(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle({ client: pool });

    // Idempotent: every `docker compose up` runs this, and only the first one
    // on an empty database should write anything.
    const existing = await db.select({ id: companies.id }).from(companies).limit(1);
    if (existing.length > 0) {
      console.log("seed skipped: data already present");
      return;
    }

    // Hashed before the transaction opens, one salt per user.
    const prepared = await Promise.all(
      SEED.map(async (entry) => ({
        company: entry.company,
        users: await Promise.all(
          entry.users.map(async (user) => ({ ...user, passwordHash: await hashPassword(DEMO_PASSWORD) })),
        ),
      })),
    );

    await db.transaction(async (tx) => {
      for (const entry of prepared) {
        const [company] = await tx.insert(companies).values({ name: entry.company }).returning({ id: companies.id });
        if (!company) throw new Error("company insert returned nothing");
        await tx.insert(users).values(entry.users.map((user) => ({ ...user, companyId: company.id })));
      }
    });

    console.log(`seeded ${prepared.length} companies and ${prepared.flatMap((c) => c.users).length} users`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("seed failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
