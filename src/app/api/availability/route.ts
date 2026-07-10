import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const dateParam = searchParams.get("date"); // "YYYY-MM-DD"
  const workerId = searchParams.get("workerId") ?? undefined;

  if (!serviceId || !dateParam) {
    return NextResponse.json({ error: "serviceId y date son obligatorios" }, { status: 400 });
  }

  const date = new Date(`${dateParam}T00:00:00.000Z`);
  const results = await getAvailableSlots({ serviceId, date, workerId });
  return NextResponse.json(results);
}
