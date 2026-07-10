import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { createAppointment } from "@/lib/appointments-service";

async function seedBasicFixture() {
  const worker = await testDb.user.create({
    data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
  });
  const client = await testDb.user.create({
    data: { email: "client@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
  });
  const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
  const shift = await testDb.shiftTemplate.create({
    data: {
      name: "Turno mañana",
      ranges: { create: [{ dayOfWeek: 1, startTime: "08:00", endTime: "16:00" }] }, // Tuesday
    },
  });
  const monday = new Date("2026-07-06T00:00:00Z");
  await testDb.workerWeekAssignment.create({
    data: { workerId: worker.id, weekStartDate: monday, shiftTemplateId: shift.id },
  });
  return { worker, client, service, tuesday: new Date("2026-07-07T00:00:00Z") };
}

describe("createAppointment", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a CONFIRMED appointment for an available slot", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const result = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "08:00",
        createdBy: "CLIENT",
      },
      testDb
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appointment.status).toBe("CONFIRMED");
      expect(result.appointment.endTime).toBe("08:30");
    }
  });

  it("rejects a slot outside the worker's shift", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const result = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "18:00",
        createdBy: "CLIENT",
      },
      testDb
    );

    expect(result).toEqual({ ok: false, reason: "SLOT_UNAVAILABLE" });
  });

  it("rejects a second booking for the same worker/date/time", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const first = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "09:00",
        createdBy: "CLIENT",
      },
      testDb
    );
    expect(first.ok).toBe(true);

    const second = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "09:00",
        createdBy: "CLIENT",
      },
      testDb
    );
    expect(second).toEqual({ ok: false, reason: "SLOT_UNAVAILABLE" });
  });

  it("allows exactly one of two concurrent bookings for the same slot to succeed", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const [a, b] = await Promise.all([
      createAppointment(
        { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "10:00", createdBy: "CLIENT" },
        testDb
      ),
      createAppointment(
        { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "10:00", createdBy: "CLIENT" },
        testDb
      ),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});

import { cancelAppointment } from "@/lib/appointments-service";

describe("cancelAppointment", () => {
  beforeEach(resetDatabase);

  it("lets the owning client cancel their own appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: client.id, actingUserRole: "CLIENT" },
      testDb
    );

    expect(result).toEqual({ ok: true });
    const updated = await testDb.appointment.findUniqueOrThrow({ where: { id: created.appointment.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("forbids a different client from cancelling someone else's appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const otherClient = await testDb.user.create({
      data: { email: "other@example.com", role: "CLIENT", name: "Otro", lastName: "Cliente" },
    });
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: otherClient.id, actingUserRole: "CLIENT" },
      testDb
    );

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("lets an admin cancel any appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const admin = await testDb.user.create({
      data: { email: "admin2@example.com", role: "ADMIN", name: "Admin", lastName: "Uno" },
    });
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: admin.id, actingUserRole: "ADMIN" },
      testDb
    );

    expect(result).toEqual({ ok: true });
  });

  it("frees the slot after cancellation so it can be booked again", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: client.id, actingUserRole: "CLIENT" },
      testDb
    );

    const rebooked = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    expect(rebooked.ok).toBe(true);
  });
});
