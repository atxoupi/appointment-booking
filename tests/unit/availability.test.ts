import { describe, expect, it } from "vitest";
import {
  timeToMinutes,
  minutesToTime,
  getMondayOfWeek,
  getDayOfWeekIndex,
  subtractBusyRanges,
  generateSlotStarts,
} from "@/lib/availability";

describe("timeToMinutes / minutesToTime", () => {
  it("converts HH:mm to minutes and back", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
  });
});

describe("getMondayOfWeek", () => {
  it("returns the same date when given a Monday", () => {
    const monday = new Date("2026-07-06T00:00:00Z"); // a Monday
    expect(getMondayOfWeek(monday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("returns the preceding Monday when given a Thursday", () => {
    const thursday = new Date("2026-07-09T00:00:00Z");
    expect(getMondayOfWeek(thursday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("returns the preceding Monday when given a Sunday", () => {
    const sunday = new Date("2026-07-12T00:00:00Z");
    expect(getMondayOfWeek(sunday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });
});

describe("getDayOfWeekIndex", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(getDayOfWeekIndex(new Date("2026-07-06T00:00:00Z"))).toBe(0);
    expect(getDayOfWeekIndex(new Date("2026-07-12T00:00:00Z"))).toBe(6);
  });
});

describe("subtractBusyRanges", () => {
  it("returns the full window when there is no busy range", () => {
    const windows = [{ startTime: "08:00", endTime: "16:00" }];
    expect(subtractBusyRanges(windows, [])).toEqual(windows);
  });

  it("splits a window around a busy range in the middle", () => {
    const windows = [{ startTime: "08:00", endTime: "16:00" }];
    const busy = [{ startTime: "10:00", endTime: "11:00" }];
    expect(subtractBusyRanges(windows, busy)).toEqual([
      { startTime: "08:00", endTime: "10:00" },
      { startTime: "11:00", endTime: "16:00" },
    ]);
  });

  it("removes a window entirely covered by a busy range", () => {
    const windows = [{ startTime: "10:00", endTime: "11:00" }];
    const busy = [{ startTime: "09:00", endTime: "12:00" }];
    expect(subtractBusyRanges(windows, busy)).toEqual([]);
  });
});

describe("generateSlotStarts", () => {
  it("generates 30-minute-stepped starts that fit the service duration", () => {
    const windows = [{ startTime: "08:00", endTime: "09:30" }];
    expect(generateSlotStarts(windows, 30)).toEqual(["08:00", "08:30", "09:00"]);
  });

  it("does not generate a start that would run past the window for a 60-minute service", () => {
    const windows = [{ startTime: "08:00", endTime: "09:30" }];
    expect(generateSlotStarts(windows, 60)).toEqual(["08:00", "08:30"]);
  });
});
