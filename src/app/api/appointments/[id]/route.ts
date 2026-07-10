import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelAppointment } from "@/lib/appointments-service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  if (body.status !== "CANCELLED") {
    return NextResponse.json({ error: "Solo se admite cancelar (status: CANCELLED)" }, { status: 400 });
  }

  const result = await cancelAppointment({
    appointmentId: params.id,
    actingUserId: session.user.id,
    actingUserRole: session.user.role,
  });

  if (!result.ok && result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: "No tienes permiso para cancelar esta cita" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
