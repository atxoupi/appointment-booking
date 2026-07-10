import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAppointment, listAppointmentsForUser } from "@/lib/appointments-service";

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
  return NextResponse.json(result.appointment, { status: 201 });
}
