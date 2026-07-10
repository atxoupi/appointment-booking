import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { assignWeeksToWorker } from "@/lib/worker-assignments-service";

describe("assignWeeksToWorker", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("assigns the same shift template to several consecutive weeks at once", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const shift = await testDb.shiftTemplate.create({ data: { name: "Turno partido" } });
    const weeks = [
      new Date("2026-07-06T00:00:00Z"),
      new Date("2026-07-13T00:00:00Z"),
      new Date("2026-07-20T00:00:00Z"),
    ];

    const assignments = await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: shift.id, weekStartDates: weeks },
      testDb
    );

    expect(assignments).toHaveLength(3);
    const stored = await testDb.workerWeekAssignment.findMany({ where: { workerId: worker.id } });
    expect(stored).toHaveLength(3);
  });

  it("overwrites an existing assignment for a week that was already set", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker2@example.com", role: "WORKER", name: "Marta", lastName: "Ruiz" },
    });
    const morning = await testDb.shiftTemplate.create({ data: { name: "Turno mañana" } });
    const afternoon = await testDb.shiftTemplate.create({ data: { name: "Turno tarde" } });
    const week = new Date("2026-07-06T00:00:00Z");

    await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: morning.id, weekStartDates: [week] },
      testDb
    );
    await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: afternoon.id, weekStartDates: [week] },
      testDb
    );

    const stored = await testDb.workerWeekAssignment.findMany({ where: { workerId: worker.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].shiftTemplateId).toBe(afternoon.id);
  });
});
