import type { PrismaClient, ShiftTemplate, ShiftTemplateRange } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type ShiftTemplateWithRanges = ShiftTemplate & { ranges: ShiftTemplateRange[] };
type RangeInput = { dayOfWeek: number; startTime: string; endTime: string };

export function listShiftTemplates(
  db: PrismaClient = defaultPrisma
): Promise<ShiftTemplateWithRanges[]> {
  return db.shiftTemplate.findMany({ include: { ranges: true }, orderBy: { name: "asc" } });
}

export function createShiftTemplate(
  input: { name: string; isVacation?: boolean; ranges: RangeInput[] },
  db: PrismaClient = defaultPrisma
): Promise<ShiftTemplate> {
  return db.shiftTemplate.create({
    data: {
      name: input.name,
      isVacation: input.isVacation ?? false,
      ranges: { create: input.ranges },
    },
  });
}

export async function updateShiftTemplateRanges(
  id: string,
  ranges: RangeInput[],
  db: PrismaClient = defaultPrisma
): Promise<void> {
  await db.$transaction([
    db.shiftTemplateRange.deleteMany({ where: { shiftTemplateId: id } }),
    db.shiftTemplateRange.createMany({ data: ranges.map((r) => ({ ...r, shiftTemplateId: id })) }),
  ]);
}
