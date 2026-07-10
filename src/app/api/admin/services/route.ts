import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listServices, createService } from "@/lib/services-service";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const services = await listServices();
  return NextResponse.json(services);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  if (!body.name || !body.durationMinutes) {
    return NextResponse.json({ error: "name y durationMinutes son obligatorios" }, { status: 400 });
  }
  const service = await createService({ name: body.name, durationMinutes: body.durationMinutes });
  return NextResponse.json(service, { status: 201 });
}
