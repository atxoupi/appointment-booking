import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { listServices, createService, updateService } from "@/lib/services-service";

describe("services-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates and lists active services", async () => {
    await createService({ name: "Corte", durationMinutes: 30 }, testDb);
    await createService({ name: "Corte + Barba", durationMinutes: 60 }, testDb);

    const services = await listServices(testDb);
    expect(services.map((s) => s.name).sort()).toEqual(["Corte", "Corte + Barba"]);
  });

  it("updates a service's duration and active flag", async () => {
    const created = await createService({ name: "Tinte", durationMinutes: 60 }, testDb);

    const updated = await updateService(created.id, { durationMinutes: 30, active: false }, testDb);

    expect(updated.durationMinutes).toBe(30);
    expect(updated.active).toBe(false);
  });

  it("excludes inactive services from listServices by default", async () => {
    const created = await createService({ name: "Descontinuado", durationMinutes: 30 }, testDb);
    await updateService(created.id, { active: false }, testDb);

    const services = await listServices(testDb);
    expect(services.find((s) => s.id === created.id)).toBeUndefined();
  });
});
