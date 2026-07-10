import { PrismaClient } from "@prisma/client";

export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

/** Deletes all rows in FK-safe order. Call in beforeEach for a clean slate. */
export async function resetDatabase() {
  await testDb.appointment.deleteMany();
  await testDb.workerWeekAssignment.deleteMany();
  await testDb.shiftTemplateRange.deleteMany();
  await testDb.shiftTemplate.deleteMany();
  await testDb.service.deleteMany();
  await testDb.user.deleteMany();
}
