import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP's Argon2id baseline. The algorithm itself is the library default
// (Argon2id); its enum is an ambient const enum that isolatedModules cannot
// import, so a unit test asserts the "$argon2id$" prefix instead.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Never throws: a malformed stored hash is just a failed verification. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verified against when the email matches no user, so an unknown email costs
 * the same Argon2 work as a wrong password and response time reveals nothing.
 */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equaliser-never-a-real-password");
  await verifyPassword(await dummyHash, password);
}
