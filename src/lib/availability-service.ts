import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  getMondayOfWeek,
  getDayOfWeekIndex,
  subtractBusyRanges,
  generateSlotStarts,
  type TimeRange,
} from "@/lib/availability";

export interface WorkerAvailability {
  workerId: string;
  workerName: string;
  slots: string[];
}

export async function getAvailableSlots(
  params: { serviceId: string; date: Date; workerId?: string },
  db: PrismaClient | Prisma.TransactionClient = defaultPrisma
): Promise<WorkerAvailability[]> {
  const service = await db.service.findUniqueOrThrow({ where: { id: params.serviceId } });
  const weekStartDate = getMondayOfWeek(params.date);
  const dayOfWeek = getDayOfWeekIndex(params.date);

  const workers = await db.user.findMany({
    where: { role: "WORKER", ...(params.workerId ? { id: params.workerId } : {}) },
  });

  const results: WorkerAvailability[] = [];

  for (const worker of workers) {
    const assignment = await db.workerWeekAssignment.findUnique({
      where: { workerId_weekStartDate: { workerId: worker.id, weekStartDate } },
      include: { shiftTemplate: { include: { ranges: true } } },
    });

    if (!assignment || assignment.shiftTemplate.isVacation) continue;

    const dayRanges: TimeRange[] = assignment.shiftTemplate.ranges
      .filter((r) => r.dayOfWeek === dayOfWeek)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }));

    if (dayRanges.length === 0) continue;

    const busyAppointments = await db.appointment.findMany({
      where: { workerId: worker.id, date: params.date, status: "CONFIRMED" },
    });
    const busyRanges: TimeRange[] = busyAppointments.map((a) => ({
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    const freeRanges = subtractBusyRanges(dayRanges, busyRanges);
    const slots = generateSlotStarts(freeRanges, service.durationMinutes);

    if (slots.length > 0) {
      results.push({ workerId: worker.id, workerName: `${worker.name} ${worker.lastName}`, slots });
    }
  }

  return results;
}
