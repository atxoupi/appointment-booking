import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assignWeeksToWorker } from "@/lib/worker-assignments-service";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const weekStartDates = (body.weekStartDates as string[]).map(
    (d) => new Date(`${d}T00:00:00.000Z`)
  );

  const assignments = await assignWeeksToWorker({
    workerId: body.workerId,
    shiftTemplateId: body.shiftTemplateId,
    weekStartDates,
  });
  return NextResponse.json(assignments, { status: 201 });
}
