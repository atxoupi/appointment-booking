import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyView } from "@/lib/appointments-service";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Parámetro date inválido (usa YYYY-MM-DD)" }, { status: 400 });
  }

  const date = new Date(`${dateParam}T00:00:00.000Z`);
  const workers = await getDailyView(date);
  return NextResponse.json(workers);
}
