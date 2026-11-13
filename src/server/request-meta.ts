import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { serverEnv } from "./env";

const ipSchema = z.union([z.ipv4(), z.ipv6()]);

/**
 * The client IP, or null when it cannot be trusted. The App Router exposes no
 * socket address, and X-Forwarded-For is whatever the client chose to send —
 * so it is read only behind a proxy we run (TRUST_PROXY), and then only the
 * rightmost entry, the one that proxy appended itself.
 */
export async function getClientIp(): Promise<string | null> {
  if (!serverEnv().TRUST_PROXY) return null;
  const forwarded = (await headers()).get("x-forwarded-for");
  const lastHop = forwarded?.split(",").at(-1)?.trim();
  const parsed = ipSchema.safeParse(lastHop);
  return parsed.success ? parsed.data : null;
}
