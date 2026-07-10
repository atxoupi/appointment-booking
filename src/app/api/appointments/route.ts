import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAppointment, listAppointmentsForUser } from "@/lib/appointments-service";
import { sendAppointmentConfirmation } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const appointments = await listAppointmentsForUser(session.user.id, session.user.role);
  return NextResponse.json(appointments);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { workerId, serviceId, date, startTime } = body;
  if (!workerId || !serviceId || !date || !startTime) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const clientId = session.user.role === "CLIENT" ? session.user.id : body.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId es obligatorio para reservas de personal" }, { status: 400 });
  }

  const result = await createAppointment({
    clientId,
    workerId,
    serviceId,
    date: new Date(`${date}T00:00:00.000Z`),
    startTime,
    createdBy: session.user.role === "CLIENT" ? "CLIENT" : "STAFF",
  });

  if (!result.ok) {
    return NextResponse.json({ error: "El horario ya no está disponible" }, { status: 409 });
  }

  const [client, worker, service] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: result.appointment.clientId } }),
    prisma.user.findUniqueOrThrow({ where: { id: result.appointment.workerId } }),
    prisma.service.findUniqueOrThrow({ where: { id: result.appointment.serviceId } }),
  ]);
  try {
    await sendAppointmentConfirmation(client.email, {
      serviceName: service.name,
      workerName: `${worker.name} ${worker.lastName}`,
      date: result.appointment.date.toISOString().slice(0, 10),
      startTime: result.appointment.startTime,
    });
  } catch (err) {
    console.error("Failed to send confirmation email:", err);
  }

  return NextResponse.json(result.appointment, { status: 201 });
}
