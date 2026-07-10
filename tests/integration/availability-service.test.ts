import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { getAvailableSlots } from "@/lib/availability-service";

async function seedWorkerWithMorningShift(workerId: string, weekStartDate: Date) {
  const shift = await testDb.shiftTemplate.create({
    data: {
      name: "Turno mañana",
      ranges: {
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: "08:00",
          endTime: "16:00",
        })),
      },
    },
  });
  await testDb.workerWeekAssignment.create({
    data: { workerId, weekStartDate, shiftTemplateId: shift.id },
  });
}

describe("getAvailableSlots", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("returns slots for a worker with an assigned shift and no conflicting appointments", async () => {
    const worker = await testDb.user.create({
      data: { email: "w1@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const monday = new Date("2026-07-06T00:00:00Z"); // Monday
    await seedWorkerWithMorningShift(worker.id, monday);

    const tuesday = new Date("2026-07-07T00:00:00Z");
    const result = await getAvailableSlots(
      { serviceId: service.id, date: tuesday },
      testDb
    );

    const workerResult = result.find((r) => r.workerId === worker.id);
    expect(workerResult?.slots).toContain("08:00");
    expect(workerResult?.slots).toContain("15:30");
    expect(workerResult?.slots).not.toContain("16:00");
  });

  it("excludes a worker with no WorkerWeekAssignment for that week", async () => {
    const worker = await testDb.user.create({
      data: { email: "w2@example.com", role: "WORKER", name: "Marta", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const tuesday = new Date("2026-07-07T00:00:00Z");

    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);

    expect(result.find((r) => r.workerId === worker.id)).toBeUndefined();
  });

  it("excludes a worker whose shift for the week is marked as vacation", async () => {
    const worker = await testDb.user.create({
      data: { email: "w3@example.com", role: "WORKER", name: "Iker", lastName: "Sola" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const vacation = await testDb.shiftTemplate.create({
      data: { name: "Vacaciones", isVacation: true },
    });
    const monday = new Date("2026-07-06T00:00:00Z");
    await testDb.workerWeekAssignment.create({
      data: { workerId: worker.id, weekStartDate: monday, shiftTemplateId: vacation.id },
    });

    const tuesday = new Date("2026-07-07T00:00:00Z");
    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);

    expect(result.find((r) => r.workerId === worker.id)).toBeUndefined();
  });

  it("removes slots already taken by a confirmed appointment", async () => {
    const worker = await testDb.user.create({
      data: { email: "w4@example.com", role: "WORKER", name: "Sara", lastName: "Vidal" },
    });
    const client = await testDb.user.create({
      data: { email: "c1@example.com", role: "CLIENT", name: "Tom", lastName: "Díaz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const monday = new Date("2026-07-06T00:00:00Z");
    await seedWorkerWithMorningShift(worker.id, monday);

    const tuesday = new Date("2026-07-07T00:00:00Z");
    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "08:00",
        endTime: "08:30",
        createdBy: "CLIENT",
      },
    });

    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);
    const workerResult = result.find((r) => r.workerId === worker.id);

    expect(workerResult?.slots).not.toContain("08:00");
    expect(workerResult?.slots).toContain("08:30");
  });
});
