import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { createWorker, listWorkers } from "@/lib/workers-service";
import { verifyPassword } from "@/lib/password";

describe("workers-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a WORKER account with a hashed password", async () => {
    const worker = await createWorker(
      { email: "nuevo@example.com", password: "clave-segura-1", name: "Iker", lastName: "Sola" },
      testDb
    );

    expect(worker.role).toBe("WORKER");
    expect(await verifyPassword("clave-segura-1", worker.passwordHash!)).toBe(true);
  });

  it("lists all workers", async () => {
    await createWorker({ email: "w1@example.com", password: "clave-segura-1", name: "A", lastName: "B" }, testDb);
    await createWorker({ email: "w2@example.com", password: "clave-segura-1", name: "C", lastName: "D" }, testDb);

    const workers = await listWorkers(testDb);
    expect(workers).toHaveLength(2);
  });

  it("rejects creating a worker with an email already in use", async () => {
    await createWorker({ email: "dup@example.com", password: "clave-segura-1", name: "A", lastName: "B" }, testDb);

    await expect(
      createWorker({ email: "dup@example.com", password: "otra-clave", name: "C", lastName: "D" }, testDb)
    ).rejects.toThrow();
  });
});
