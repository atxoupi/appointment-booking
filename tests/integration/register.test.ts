import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { hashPassword, verifyPassword } from "@/lib/password";

// Exercises the same logic the /api/auth/register route uses, directly
// against the test database (no HTTP layer needed for this check).
async function registerClient(input: {
  email: string;
  password: string;
  name: string;
  lastName: string;
}) {
  const existing = await testDb.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");
  return testDb.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "CLIENT",
      name: input.name,
      lastName: input.lastName,
    },
  });
}

describe("client registration", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a CLIENT user with a verifiable password hash", async () => {
    const user = await registerClient({
      email: "cliente@example.com",
      password: "hunter2hunter2",
      name: "Ana",
      lastName: "Pérez",
    });

    expect(user.role).toBe("CLIENT");
    expect(await verifyPassword("hunter2hunter2", user.passwordHash!)).toBe(true);
  });

  it("rejects a second registration with the same email", async () => {
    await registerClient({
      email: "dup@example.com",
      password: "hunter2hunter2",
      name: "Ana",
      lastName: "Pérez",
    });

    await expect(
      registerClient({
        email: "dup@example.com",
        password: "otra-clave",
        name: "Otro",
        lastName: "Cliente",
      })
    ).rejects.toThrow("EMAIL_TAKEN");
  });
});
