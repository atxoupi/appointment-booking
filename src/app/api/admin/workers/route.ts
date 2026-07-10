import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { User } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { createWorker, listWorkers } from "@/lib/workers-service";

export function toSafeWorker(worker: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it from the response
  const { passwordHash, ...safeWorker } = worker;
  return safeWorker;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const workers = await listWorkers();
  return NextResponse.json(workers.map(toSafeWorker));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const worker = await createWorker(body);
    return NextResponse.json(toSafeWorker(worker), { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }
    throw err;
  }
}
