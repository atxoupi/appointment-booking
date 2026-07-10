export interface TimeRange {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Returns a UTC midnight Date for the Monday of the week containing `date`. */
export function getMondayOfWeek(date: Date): Date {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const jsDay = utcDate.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
  return utcDate;
}

/** 0 = Monday ... 6 = Sunday, matching ShiftTemplateRange.dayOfWeek. */
export function getDayOfWeekIndex(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Subtracts each busy range from the given windows, returning the free sub-ranges. */
export function subtractBusyRanges(
  windows: TimeRange[],
  busyRanges: TimeRange[]
): TimeRange[] {
  let free = windows.map((w) => ({ ...w }));

  for (const busy of busyRanges) {
    const busyStart = timeToMinutes(busy.startTime);
    const busyEnd = timeToMinutes(busy.endTime);
    const next: TimeRange[] = [];

    for (const window of free) {
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);

      if (busyEnd <= windowStart || busyStart >= windowEnd) {
        next.push(window);
        continue;
      }
      if (busyStart > windowStart) {
        next.push({
          startTime: minutesToTime(windowStart),
          endTime: minutesToTime(Math.min(busyStart, windowEnd)),
        });
      }
      if (busyEnd < windowEnd) {
        next.push({
          startTime: minutesToTime(Math.max(busyEnd, windowStart)),
          endTime: minutesToTime(windowEnd),
        });
      }
    }
    free = next;
  }

  return free;
}

/** Generates candidate start times (stepMinutes apart) that fit durationMinutes inside each window. */
export function generateSlotStarts(
  windows: TimeRange[],
  durationMinutes: number,
  stepMinutes = 30
): string[] {
  const slots: string[] = [];
  for (const window of windows) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    for (let t = start; t + durationMinutes <= end; t += stepMinutes) {
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}
