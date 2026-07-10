import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { authOptions } from "@/lib/auth";

// authOptions.callbacks.signIn (src/lib/auth.ts) reads/writes through the
// `prisma` singleton from "@/lib/prisma", which points at DATABASE_URL (the
// dev database). Redirect it to a second real connection to the test
// database so this test exercises the *actual* production callback, not a
// reimplementation of its logic, without touching the dev database.
// vi.mock calls are hoisted above the imports above, so "@/lib/auth" (and
// therefore "@/lib/prisma") resolves against this mock.
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } }),
  };
});

type SignInCallback = NonNullable<NonNullable<typeof authOptions.callbacks>["signIn"]>;
type SignInParams = Parameters<SignInCallback>[0];

describe("authOptions.callbacks.signIn", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a CLIENT user on first Google sign-in for a new email", async () => {
    const params: SignInParams = {
      user: { id: "google-sub-1", name: "Ana Pérez", email: "ana.new@example.com", image: null },
      account: { provider: "google", type: "oauth", providerAccountId: "google-sub-1" },
    };

    const result = await authOptions.callbacks!.signIn!(params);

    expect(result).toBe(true);
    const created = await testDb.user.findUnique({ where: { email: "ana.new@example.com" } });
    expect(created).not.toBeNull();
    expect(created?.role).toBe("CLIENT");
    expect(created?.name).toBe("Ana");
    expect(created?.lastName).toBe("Pérez");
  });

  it("does not create a duplicate or change the role of an existing WORKER on Google sign-in", async () => {
    await testDb.user.create({
      data: { email: "worker@example.com", role: "WORKER", name: "Wendy", lastName: "Worker" },
    });

    const params: SignInParams = {
      user: { id: "google-sub-2", name: "Wendy Worker", email: "worker@example.com", image: null },
      account: { provider: "google", type: "oauth", providerAccountId: "google-sub-2" },
    };

    const result = await authOptions.callbacks!.signIn!(params);

    expect(result).toBe(true);
    const rows = await testDb.user.findMany({ where: { email: "worker@example.com" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("WORKER");
  });

  it("does not create a duplicate or change the role of an existing ADMIN on Google sign-in", async () => {
    await testDb.user.create({
      data: { email: "admin@example.com", role: "ADMIN", name: "Alex", lastName: "Admin" },
    });

    const params: SignInParams = {
      user: { id: "google-sub-3", name: "Alex Admin", email: "admin@example.com", image: null },
      account: { provider: "google", type: "oauth", providerAccountId: "google-sub-3" },
    };

    const result = await authOptions.callbacks!.signIn!(params);

    expect(result).toBe(true);
    const rows = await testDb.user.findMany({ where: { email: "admin@example.com" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("ADMIN");
  });

  it("does not run the user-creation branch for a non-Google (credentials) sign-in", async () => {
    const params: SignInParams = {
      user: { id: "cred-user-1", name: "Cliente", email: "cliente@example.com" },
      account: { provider: "credentials", type: "credentials", providerAccountId: "cred-user-1" },
    };

    const result = await authOptions.callbacks!.signIn!(params);

    expect(result).toBe(true);
    // Scope to this test's own email rather than the whole table: with
    // fileParallelism disabled this file no longer races other integration
    // test files, but a whole-table assertion would still be needlessly
    // coupled to what else this describe block does.
    const rows = await testDb.user.findMany({ where: { email: "cliente@example.com" } });
    expect(rows).toHaveLength(0);
  });
});
