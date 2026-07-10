import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me-please";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
      name: "Admin",
      lastName: "Principal",
    },
  });

  await prisma.service.createMany({
    data: [
      { name: "Corte", durationMinutes: 30 },
      { name: "Corte + Barba", durationMinutes: 60 },
    ],
    skipDuplicates: true,
  });

  const morningShift = await prisma.shiftTemplate.upsert({
    where: { id: "seed-turno-manana" },
    update: {},
    create: {
      id: "seed-turno-manana",
      name: "Turno mañana",
      ranges: {
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: "08:00",
          endTime: "16:00",
        })),
      },
    },
  });

  await prisma.shiftTemplate.upsert({
    where: { id: "seed-vacaciones" },
    update: {},
    create: {
      id: "seed-vacaciones",
      name: "Vacaciones",
      isVacation: true,
    },
  });

  console.log("Seed complete. Admin login:", adminEmail);
  console.log("Sample shift template id:", morningShift.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
