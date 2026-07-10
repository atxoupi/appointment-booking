import type { User } from "@prisma/client";

export function toSafeWorker(worker: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it from the response
  const { passwordHash, ...safeWorker } = worker;
  return safeWorker;
}
