// src/app/api/cron/reminders/route.ts
import { NextResponse } from "next/server";
import type { Appointment, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { sendAppointmentReminder } from "@/lib/email";

export async function findAppointmentsNeedingReminder(
  now: Date,
  db: PrismaClient = defaultPrisma
): Promise<Appointment[]> {
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );

  return db.appointment.findMany({
    where: { status: "CONFIRMED", date: tomorrow },
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const appointments = await findAppointmentsNeedingReminder(new Date());

  for (const appointment of appointments) {
    const [client, worker, service] = await Promise.all([
      defaultPrisma.user.findUniqueOrThrow({ where: { id: appointment.clientId } }),
      defaultPrisma.user.findUniqueOrThrow({ where: { id: appointment.workerId } }),
      defaultPrisma.service.findUniqueOrThrow({ where: { id: appointment.serviceId } }),
    ]);
    await sendAppointmentReminder(client.email, {
      serviceName: service.name,
      workerName: `${worker.name} ${worker.lastName}`,
      date: appointment.date.toISOString().slice(0, 10),
      startTime: appointment.startTime,
    });
  }

  return NextResponse.json({ remindersSent: appointments.length });
}
