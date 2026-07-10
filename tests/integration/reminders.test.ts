// tests/integration/reminders.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { findAppointmentsNeedingReminder } from "@/app/api/cron/reminders/route";

describe("findAppointmentsNeedingReminder", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("finds a CONFIRMED appointment exactly one day from now", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const tomorrow = new Date("2026-07-07T00:00:00Z");

    const appointment = await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tomorrow,
        startTime: "10:00",
        endTime: "10:30",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found.map((a) => a.id)).toContain(appointment.id);
  });

  it("does not return an appointment that is 3 days away", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker2@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client2@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const inThreeDays = new Date("2026-07-09T00:00:00Z");

    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: inThreeDays,
        startTime: "10:00",
        endTime: "10:30",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found).toHaveLength(0);
  });

  it("does not return a CANCELLED appointment", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker3@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client3@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const tomorrow = new Date("2026-07-07T00:00:00Z");

    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tomorrow,
        startTime: "10:00",
        endTime: "10:30",
        status: "CANCELLED",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found).toHaveLength(0);
  });
});
