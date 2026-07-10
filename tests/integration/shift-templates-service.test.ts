import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import {
  listShiftTemplates,
  createShiftTemplate,
  updateShiftTemplateRanges,
} from "@/lib/shift-templates-service";

describe("shift-templates-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a shift template with per-day ranges, including a split shift", async () => {
    const shift = await createShiftTemplate(
      {
        name: "Turno partido",
        ranges: [
          { dayOfWeek: 0, startTime: "10:00", endTime: "14:00" },
          { dayOfWeek: 0, startTime: "16:00", endTime: "20:00" },
        ],
      },
      testDb
    );

    const [withRanges] = await listShiftTemplates(testDb);
    expect(withRanges.ranges).toHaveLength(2);
    expect(shift.name).toBe("Turno partido");
  });

  it("creates a vacation template with no ranges", async () => {
    const shift = await createShiftTemplate({ name: "Vacaciones", isVacation: true, ranges: [] }, testDb);
    expect(shift.isVacation).toBe(true);
  });

  it("replaces a template's ranges entirely on update", async () => {
    const shift = await createShiftTemplate(
      { name: "Turno mañana", ranges: [{ dayOfWeek: 0, startTime: "08:00", endTime: "16:00" }] },
      testDb
    );

    await updateShiftTemplateRanges(
      shift.id,
      [{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }],
      testDb
    );

    const [updated] = await listShiftTemplates(testDb);
    expect(updated.ranges).toEqual([
      expect.objectContaining({ startTime: "09:00", endTime: "17:00" }),
    ]);
  });
});
