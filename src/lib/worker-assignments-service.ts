import type { PrismaClient, WorkerWeekAssignment } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export async function assignWeeksToWorker(
  input: { workerId: string; shiftTemplateId: string; weekStartDates: Date[] },
  db: PrismaClient = defaultPrisma
): Promise<WorkerWeekAssignment[]> {
  return Promise.all(
    input.weekStartDates.map((weekStartDate) =>
      db.workerWeekAssignment.upsert({
        where: { workerId_weekStartDate: { workerId: input.workerId, weekStartDate } },
        update: { shiftTemplateId: input.shiftTemplateId },
        create: {
          workerId: input.workerId,
          weekStartDate,
          shiftTemplateId: input.shiftTemplateId,
        },
      })
    )
  );
}
