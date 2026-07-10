# Appointment Booking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a traditional (no AI/agents) web app for a hair salon to manage worker shift rotations and let clients book/cancel appointments online, with staff able to manage everything from an admin/worker dashboard.

**Architecture:** Next.js 14 (App Router) full-stack app in TypeScript, PostgreSQL via Prisma, NextAuth.js (JWT sessions, Credentials + Google), Resend for transactional email. Business logic lives in plain TypeScript service modules under `src/lib/`; API routes are thin wrappers that check auth/role and call those services. This keeps the availability/booking logic unit- and integration-testable without spinning up a live HTTP server.

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL, Prisma, NextAuth.js v4, bcryptjs, Resend, Vitest, Docker Compose (local Postgres).

## Global Constraints

- No AI/LLM agents anywhere in the runtime system (per spec).
- Single-tenant: this codebase serves one business per deployment. No tenant-scoping fields.
- Two fixed service durations for now (30/60 min), stored as a numeric field so more can be added later without a schema change.
- All client bookings require login (no guest checkout). Workers/admins never self-register; admin creates worker accounts, and the first admin comes from a seed script.
- No online payments, no per-worker service restrictions (every worker can perform every service).
- Every service-layer function (the `src/lib/*-service.ts` files) must have integration test coverage against a real Postgres test database — not mocks — because the whole point of this system is correct interaction between schedule data and the database.

---

## File Structure

```
docker-compose.yml
.env.example
vitest.config.ts
prisma/
  schema.prisma
  migrations/
  seed.ts
src/
  lib/
    prisma.ts                    # Prisma client singleton
    password.ts                  # bcrypt hash/verify helpers
    auth.ts                      # NextAuth config
    availability.ts              # pure time-math functions
    availability-service.ts      # DB-aware slot computation
    appointments-service.ts      # create/cancel/list appointments
    services-service.ts          # admin CRUD for Service
    shift-templates-service.ts   # admin CRUD for ShiftTemplate + ranges
    worker-assignments-service.ts# admin bulk-assign turnos
    workers-service.ts           # admin creates worker accounts
    email.ts                     # Resend wrapper
  middleware.ts                  # role-based route protection
  app/
    api/
      auth/[...nextauth]/route.ts
      auth/register/route.ts
      availability/route.ts
      appointments/route.ts
      appointments/[id]/route.ts
      cron/reminders/route.ts
      admin/services/route.ts
      admin/services/[id]/route.ts
      admin/shift-templates/route.ts
      admin/shift-templates/[id]/route.ts
      admin/worker-assignments/route.ts
      admin/workers/route.ts
    login/page.tsx
    register/page.tsx
    book/page.tsx
    my-appointments/page.tsx
    worker/page.tsx
    admin/services/page.tsx
    admin/shift-templates/page.tsx
    admin/assignments/page.tsx
    admin/workers/page.tsx
    admin/appointments/page.tsx
tests/
  unit/
    availability.test.ts
    email.test.ts
  integration/
    setup.ts
    availability-service.test.ts
    appointments-service.test.ts
    services-service.test.ts
    shift-templates-service.test.ts
    worker-assignments-service.test.ts
    workers-service.test.ts
    reminders.test.ts
```

---

### Task 1: Project scaffolding and local Postgres

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `vitest.config.ts`
- Create: `docker-compose.yml`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (placeholder home page)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a runnable Next.js dev server, a `docker-compose up` Postgres instance, and `npm test` running Vitest — everything later tasks build on.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@14 . --typescript --app --eslint --src-dir --import-alias "@/*" --no-tailwind
```

Answer "No" to any prompt that would overwrite this plan's `docs/` folder if asked; keep existing files.

- [ ] **Step 2: Add project dependencies**

```bash
npm install next-auth@4 bcryptjs resend @prisma/client
npm install -D prisma vitest dotenv tsx @types/bcryptjs
```

- [ ] **Step 3: Add Postgres via Docker Compose**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: appointments
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
  test-db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: appointments_test
    ports:
      - "5433:5432"
volumes:
  db-data:
```

- [ ] **Step 4: Add environment variable template**

```bash
# .env.example
DATABASE_URL="postgresql://app:app@localhost:5432/appointments"
TEST_DATABASE_URL="postgresql://app:app@localhost:5433/appointments_test"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-random-32-byte-string"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
RESEND_API_KEY=""
EMAIL_FROM="citas@example.com"
ADMIN_SEED_EMAIL="admin@example.com"
ADMIN_SEED_PASSWORD="change-me-please"
```

Copy it: `cp .env.example .env` and fill in real values later (Google/Resend keys can stay empty until Task 4/12).

- [ ] **Step 5: Configure Vitest**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
  },
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:up": "docker compose up -d db test-db"
  }
}
```

- [ ] **Step 6: Verify the app boots**

```bash
npm run db:up
npm run dev
```

Expected: dev server starts on `http://localhost:3000` without errors. Stop it with Ctrl+C once confirmed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, Postgres, and Vitest"
```

---

### Task 2: Prisma schema, migration, and seed data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/lib/prisma.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `DATABASE_URL` / `TEST_DATABASE_URL` from `.env` (Task 1)
- Produces: Prisma Client types (`User`, `Service`, `ShiftTemplate`, `ShiftTemplateRange`, `WorkerWeekAssignment`, `Appointment`, and enums `Role`, `AppointmentStatus`, `CreatedBy`) — every later task imports these from `@prisma/client`. Also produces `prisma` singleton at `src/lib/prisma.ts` used by every service module.

- [ ] **Step 1: Write the Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CLIENT
  WORKER
  ADMIN
}

enum AppointmentStatus {
  CONFIRMED
  CANCELLED
}

enum CreatedBy {
  CLIENT
  STAFF
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?
  role         Role
  name         String
  lastName     String
  phone        String?
  createdAt    DateTime @default(now())

  appointmentsAsClient Appointment[]           @relation("ClientAppointments")
  appointmentsAsWorker Appointment[]           @relation("WorkerAppointments")
  weekAssignments      WorkerWeekAssignment[]
}

model Service {
  id              String   @id @default(cuid())
  name            String
  durationMinutes Int
  active          Boolean  @default(true)

  appointments Appointment[]
}

model ShiftTemplate {
  id         String  @id @default(cuid())
  name       String
  isVacation Boolean @default(false)

  ranges      ShiftTemplateRange[]
  assignments WorkerWeekAssignment[]
}

model ShiftTemplateRange {
  id              String @id @default(cuid())
  shiftTemplateId String
  dayOfWeek       Int
  startTime       String
  endTime         String

  shiftTemplate ShiftTemplate @relation(fields: [shiftTemplateId], references: [id], onDelete: Cascade)

  @@index([shiftTemplateId, dayOfWeek])
}

model WorkerWeekAssignment {
  id              String   @id @default(cuid())
  workerId        String
  weekStartDate   DateTime
  shiftTemplateId String

  worker        User          @relation(fields: [workerId], references: [id])
  shiftTemplate ShiftTemplate @relation(fields: [shiftTemplateId], references: [id])

  @@unique([workerId, weekStartDate])
}

model Appointment {
  id        String            @id @default(cuid())
  clientId  String
  workerId  String
  serviceId String
  date      DateTime
  startTime String
  endTime   String
  status    AppointmentStatus @default(CONFIRMED)
  createdBy CreatedBy
  createdAt DateTime          @default(now())

  client  User    @relation("ClientAppointments", fields: [clientId], references: [id])
  worker  User    @relation("WorkerAppointments", fields: [workerId], references: [id])
  service Service @relation(fields: [serviceId], references: [id])

  @@index([workerId, date])
}
```

Note: the `(workerId, date, startTime)` uniqueness for `CONFIRMED` appointments is a **partial** unique index (Postgres-only feature) and can't be expressed in `schema.prisma`'s `@@unique`, so it's added by hand-editing the generated migration SQL in Step 3.

- [ ] **Step 2: Create the Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Generate the migration and hand-add the partial unique index**

```bash
npx prisma migrate dev --name init --create-only
```

Open the newly created file at `prisma/migrations/<timestamp>_init/migration.sql` and append this line at the end of the file:

```sql
CREATE UNIQUE INDEX "appointment_worker_slot_confirmed_idx"
ON "Appointment" ("workerId", "date", "startTime")
WHERE "status" = 'CONFIRMED';
```

Then apply it:

```bash
npx prisma migrate dev
```

Expected: `Your database is now in sync with your schema.` Verify the index exists:

```bash
docker compose exec db psql -U app -d appointments -c "\d \"Appointment\""
```

Expected output includes a line for `appointment_worker_slot_confirmed_idx`.

- [ ] **Step 4: Apply the same migration to the test database**

```bash
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
```

(If your shell doesn't export `.env` vars automatically, run `export $(cat .env | xargs)` first, or pass the URL inline: `DATABASE_URL="postgresql://app:app@localhost:5433/appointments_test" npx prisma migrate deploy`.)

- [ ] **Step 5: Write the seed script**

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me-please";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
      name: "Admin",
      lastName: "Principal",
    },
  });

  await prisma.service.createMany({
    data: [
      { name: "Corte", durationMinutes: 30 },
      { name: "Corte + Barba", durationMinutes: 60 },
    ],
    skipDuplicates: true,
  });

  const morningShift = await prisma.shiftTemplate.upsert({
    where: { id: "seed-turno-manana" },
    update: {},
    create: {
      id: "seed-turno-manana",
      name: "Turno mañana",
      ranges: {
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: "08:00",
          endTime: "16:00",
        })),
      },
    },
  });

  await prisma.shiftTemplate.upsert({
    where: { id: "seed-vacaciones" },
    update: {},
    create: {
      id: "seed-vacaciones",
      name: "Vacaciones",
      isVacation: true,
    },
  });

  console.log("Seed complete. Admin login:", adminEmail);
  console.log("Sample shift template id:", morningShift.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Wire up the seed command and run it**

```json
// package.json (add this top-level key)
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

```bash
npx prisma db seed
```

Expected: `Seed complete. Admin login: admin@example.com` printed, no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema, migration with partial unique index, and seed script"
```

---

### Task 3: Availability pure functions

**Files:**
- Create: `src/lib/availability.ts`
- Test: `tests/unit/availability.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB, no Prisma types)
- Produces: `TimeRange` type, `timeToMinutes`, `minutesToTime`, `getMondayOfWeek`, `getDayOfWeekIndex`, `subtractBusyRanges`, `generateSlotStarts` — all imported by `src/lib/availability-service.ts` in Task 5.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/availability.test.ts
import { describe, expect, it } from "vitest";
import {
  timeToMinutes,
  minutesToTime,
  getMondayOfWeek,
  getDayOfWeekIndex,
  subtractBusyRanges,
  generateSlotStarts,
} from "@/lib/availability";

describe("timeToMinutes / minutesToTime", () => {
  it("converts HH:mm to minutes and back", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
  });
});

describe("getMondayOfWeek", () => {
  it("returns the same date when given a Monday", () => {
    const monday = new Date("2026-07-06T00:00:00Z"); // a Monday
    expect(getMondayOfWeek(monday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("returns the preceding Monday when given a Thursday", () => {
    const thursday = new Date("2026-07-09T00:00:00Z");
    expect(getMondayOfWeek(thursday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("returns the preceding Monday when given a Sunday", () => {
    const sunday = new Date("2026-07-12T00:00:00Z");
    expect(getMondayOfWeek(sunday).toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });
});

describe("getDayOfWeekIndex", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(getDayOfWeekIndex(new Date("2026-07-06T00:00:00Z"))).toBe(0);
    expect(getDayOfWeekIndex(new Date("2026-07-12T00:00:00Z"))).toBe(6);
  });
});

describe("subtractBusyRanges", () => {
  it("returns the full window when there is no busy range", () => {
    const windows = [{ startTime: "08:00", endTime: "16:00" }];
    expect(subtractBusyRanges(windows, [])).toEqual(windows);
  });

  it("splits a window around a busy range in the middle", () => {
    const windows = [{ startTime: "08:00", endTime: "16:00" }];
    const busy = [{ startTime: "10:00", endTime: "11:00" }];
    expect(subtractBusyRanges(windows, busy)).toEqual([
      { startTime: "08:00", endTime: "10:00" },
      { startTime: "11:00", endTime: "16:00" },
    ]);
  });

  it("removes a window entirely covered by a busy range", () => {
    const windows = [{ startTime: "10:00", endTime: "11:00" }];
    const busy = [{ startTime: "09:00", endTime: "12:00" }];
    expect(subtractBusyRanges(windows, busy)).toEqual([]);
  });
});

describe("generateSlotStarts", () => {
  it("generates 30-minute-stepped starts that fit the service duration", () => {
    const windows = [{ startTime: "08:00", endTime: "09:30" }];
    expect(generateSlotStarts(windows, 30)).toEqual(["08:00", "08:30", "09:00"]);
  });

  it("does not generate a start that would run past the window for a 60-minute service", () => {
    const windows = [{ startTime: "08:00", endTime: "09:30" }];
    expect(generateSlotStarts(windows, 60)).toEqual(["08:00", "08:30"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/availability.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/availability'`.

- [ ] **Step 3: Implement the pure functions**

```typescript
// src/lib/availability.ts
export interface TimeRange {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Returns a UTC midnight Date for the Monday of the week containing `date`. */
export function getMondayOfWeek(date: Date): Date {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const jsDay = utcDate.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
  return utcDate;
}

/** 0 = Monday ... 6 = Sunday, matching ShiftTemplateRange.dayOfWeek. */
export function getDayOfWeekIndex(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Subtracts each busy range from the given windows, returning the free sub-ranges. */
export function subtractBusyRanges(
  windows: TimeRange[],
  busyRanges: TimeRange[]
): TimeRange[] {
  let free = windows.map((w) => ({ ...w }));

  for (const busy of busyRanges) {
    const busyStart = timeToMinutes(busy.startTime);
    const busyEnd = timeToMinutes(busy.endTime);
    const next: TimeRange[] = [];

    for (const window of free) {
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);

      if (busyEnd <= windowStart || busyStart >= windowEnd) {
        next.push(window);
        continue;
      }
      if (busyStart > windowStart) {
        next.push({
          startTime: minutesToTime(windowStart),
          endTime: minutesToTime(Math.min(busyStart, windowEnd)),
        });
      }
      if (busyEnd < windowEnd) {
        next.push({
          startTime: minutesToTime(Math.max(busyEnd, windowStart)),
          endTime: minutesToTime(windowEnd),
        });
      }
    }
    free = next;
  }

  return free;
}

/** Generates candidate start times (stepMinutes apart) that fit durationMinutes inside each window. */
export function generateSlotStarts(
  windows: TimeRange[],
  durationMinutes: number,
  stepMinutes = 30
): string[] {
  const slots: string[] = [];
  for (const window of windows) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    for (let t = start; t + durationMinutes <= end; t += stepMinutes) {
      slots.push(minutesToTime(t));
    }
  }
  return slots;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/availability.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability.ts tests/unit/availability.test.ts
git commit -m "feat: add pure availability time-math functions"
```

---

### Task 4: Auth (NextAuth, password hashing, client registration, route protection)

**Files:**
- Create: `src/lib/password.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/middleware.ts`
- Test: `tests/unit/password.test.ts`
- Test: `tests/integration/setup.ts`
- Test: `tests/integration/register.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), Prisma `Role` enum (Task 2)
- Produces: `hashPassword`, `verifyPassword` (used by registration and by `workers-service.ts` in Task 11); `authOptions` (NextAuth config, used by the route handler and by any server component needing `getServerSession(authOptions)`); session `token.role` / `session.user.role` shape (`"CLIENT" | "WORKER" | "ADMIN"`) consumed by every API route to authorize requests, and by `middleware.ts`.

- [ ] **Step 1: Write the failing password unit test**

```typescript
// tests/unit/password.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/password.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/password'`.

- [ ] **Step 3: Implement password hashing**

```typescript
// src/lib/password.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/password.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the NextAuth config**

Google sign-in is only ever treated as a login method for an **existing** user row (matched by email) — it never creates a new WORKER/ADMIN account, and if no user exists yet it creates a CLIENT (self-service is only for clients, per spec).

```typescript
// src/lib/auth.ts
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const existing = await prisma.user.findUnique({ where: { email: user.email! } });
      if (existing) return true;

      const [firstName, ...rest] = (user.name ?? "Cliente").split(" ");
      await prisma.user.create({
        data: {
          email: user.email!,
          role: "CLIENT",
          name: firstName,
          lastName: rest.join(" ") || "-",
        },
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: user.email! } });
        token.role = dbUser.role;
        token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "CLIENT" | "WORKER" | "ADMIN";
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
```

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

Add the module augmentation so `session.user.role` / `.id` type-check:

```typescript
// src/lib/next-auth.d.ts
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
  }
}
```

- [ ] **Step 6: Write client self-registration endpoint**

```typescript
// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, name, lastName, phone } = body;

  if (!email || !password || !name || !lastName) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "CLIENT",
      name,
      lastName,
      phone,
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
```

- [ ] **Step 7: Write the integration test setup helper**

```typescript
// tests/integration/setup.ts
import { PrismaClient } from "@prisma/client";

export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

/** Deletes all rows in FK-safe order. Call in beforeEach for a clean slate. */
export async function resetDatabase() {
  await testDb.appointment.deleteMany();
  await testDb.workerWeekAssignment.deleteMany();
  await testDb.shiftTemplateRange.deleteMany();
  await testDb.shiftTemplate.deleteMany();
  await testDb.service.deleteMany();
  await testDb.user.deleteMany();
}
```

- [ ] **Step 8: Write the failing registration integration test**

```typescript
// tests/integration/register.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { hashPassword, verifyPassword } from "@/lib/password";

// Exercises the same logic the /api/auth/register route uses, directly
// against the test database (no HTTP layer needed for this check).
async function registerClient(input: {
  email: string;
  password: string;
  name: string;
  lastName: string;
}) {
  const existing = await testDb.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");
  return testDb.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "CLIENT",
      name: input.name,
      lastName: input.lastName,
    },
  });
}

describe("client registration", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a CLIENT user with a verifiable password hash", async () => {
    const user = await registerClient({
      email: "cliente@example.com",
      password: "hunter2hunter2",
      name: "Ana",
      lastName: "Pérez",
    });

    expect(user.role).toBe("CLIENT");
    expect(await verifyPassword("hunter2hunter2", user.passwordHash!)).toBe(true);
  });

  it("rejects a second registration with the same email", async () => {
    await registerClient({
      email: "dup@example.com",
      password: "hunter2hunter2",
      name: "Ana",
      lastName: "Pérez",
    });

    await expect(
      registerClient({
        email: "dup@example.com",
        password: "otra-clave",
        name: "Otro",
        lastName: "Cliente",
      })
    ).rejects.toThrow("EMAIL_TAKEN");
  });
});
```

- [ ] **Step 9: Run test to verify it fails, then passes**

```bash
npm test -- tests/integration/register.test.ts
```

Expected first run: FAIL (no test DB reachable / table empty is fine — actually since logic is inline, it should PASS once `TEST_DATABASE_URL` is reachable and migrated from Task 2). If it fails with a connection error, run `npm run db:up` first. Once the DB is up: PASS.

- [ ] **Step 10: Write role-based route protection middleware**

```typescript
// src/middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (path.startsWith("/worker") && role !== "WORKER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if ((path.startsWith("/book") || path.startsWith("/my-appointments")) && role !== "CLIENT") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token } }
);

export const config = {
  matcher: ["/admin/:path*", "/worker/:path*", "/book/:path*", "/my-appointments/:path*"],
};
```

- [ ] **Step 11: Run the full test suite**

```bash
npm test
```

Expected: all tests (Tasks 3 + 4) PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add auth (credentials + Google), client registration, and role middleware"
```

---

### Task 5: Availability service (DB-aware slot computation)

**Files:**
- Create: `src/lib/availability-service.ts`
- Create: `src/app/api/availability/route.ts`
- Test: `tests/integration/availability-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `getMondayOfWeek`, `getDayOfWeekIndex`, `subtractBusyRanges`, `generateSlotStarts` (Task 3)
- Produces: `getAvailableSlots(params: { serviceId: string; date: Date; workerId?: string }, db?: PrismaClient): Promise<Array<{ workerId: string; workerName: string; slots: string[] }>>` — consumed by `appointments-service.ts` (Task 6) and by `/api/availability`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/availability-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { getAvailableSlots } from "@/lib/availability-service";

async function seedWorkerWithMorningShift(workerId: string, weekStartDate: Date) {
  const shift = await testDb.shiftTemplate.create({
    data: {
      name: "Turno mañana",
      ranges: {
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: "08:00",
          endTime: "16:00",
        })),
      },
    },
  });
  await testDb.workerWeekAssignment.create({
    data: { workerId, weekStartDate, shiftTemplateId: shift.id },
  });
}

describe("getAvailableSlots", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("returns slots for a worker with an assigned shift and no conflicting appointments", async () => {
    const worker = await testDb.user.create({
      data: { email: "w1@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const monday = new Date("2026-07-06T00:00:00Z"); // Monday
    await seedWorkerWithMorningShift(worker.id, monday);

    const tuesday = new Date("2026-07-07T00:00:00Z");
    const result = await getAvailableSlots(
      { serviceId: service.id, date: tuesday },
      testDb
    );

    const workerResult = result.find((r) => r.workerId === worker.id);
    expect(workerResult?.slots).toContain("08:00");
    expect(workerResult?.slots).toContain("15:30");
    expect(workerResult?.slots).not.toContain("16:00");
  });

  it("excludes a worker with no WorkerWeekAssignment for that week", async () => {
    const worker = await testDb.user.create({
      data: { email: "w2@example.com", role: "WORKER", name: "Marta", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const tuesday = new Date("2026-07-07T00:00:00Z");

    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);

    expect(result.find((r) => r.workerId === worker.id)).toBeUndefined();
  });

  it("excludes a worker whose shift for the week is marked as vacation", async () => {
    const worker = await testDb.user.create({
      data: { email: "w3@example.com", role: "WORKER", name: "Iker", lastName: "Sola" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const vacation = await testDb.shiftTemplate.create({
      data: { name: "Vacaciones", isVacation: true },
    });
    const monday = new Date("2026-07-06T00:00:00Z");
    await testDb.workerWeekAssignment.create({
      data: { workerId: worker.id, weekStartDate: monday, shiftTemplateId: vacation.id },
    });

    const tuesday = new Date("2026-07-07T00:00:00Z");
    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);

    expect(result.find((r) => r.workerId === worker.id)).toBeUndefined();
  });

  it("removes slots already taken by a confirmed appointment", async () => {
    const worker = await testDb.user.create({
      data: { email: "w4@example.com", role: "WORKER", name: "Sara", lastName: "Vidal" },
    });
    const client = await testDb.user.create({
      data: { email: "c1@example.com", role: "CLIENT", name: "Tom", lastName: "Díaz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const monday = new Date("2026-07-06T00:00:00Z");
    await seedWorkerWithMorningShift(worker.id, monday);

    const tuesday = new Date("2026-07-07T00:00:00Z");
    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "08:00",
        endTime: "08:30",
        createdBy: "CLIENT",
      },
    });

    const result = await getAvailableSlots({ serviceId: service.id, date: tuesday }, testDb);
    const workerResult = result.find((r) => r.workerId === worker.id);

    expect(workerResult?.slots).not.toContain("08:00");
    expect(workerResult?.slots).toContain("08:30");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/availability-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/availability-service'`.

- [ ] **Step 3: Implement the availability service**

```typescript
// src/lib/availability-service.ts
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  getMondayOfWeek,
  getDayOfWeekIndex,
  subtractBusyRanges,
  generateSlotStarts,
  type TimeRange,
} from "@/lib/availability";

export interface WorkerAvailability {
  workerId: string;
  workerName: string;
  slots: string[];
}

export async function getAvailableSlots(
  params: { serviceId: string; date: Date; workerId?: string },
  db: PrismaClient = defaultPrisma
): Promise<WorkerAvailability[]> {
  const service = await db.service.findUniqueOrThrow({ where: { id: params.serviceId } });
  const weekStartDate = getMondayOfWeek(params.date);
  const dayOfWeek = getDayOfWeekIndex(params.date);

  const workers = await db.user.findMany({
    where: { role: "WORKER", ...(params.workerId ? { id: params.workerId } : {}) },
  });

  const results: WorkerAvailability[] = [];

  for (const worker of workers) {
    const assignment = await db.workerWeekAssignment.findUnique({
      where: { workerId_weekStartDate: { workerId: worker.id, weekStartDate } },
      include: { shiftTemplate: { include: { ranges: true } } },
    });

    if (!assignment || assignment.shiftTemplate.isVacation) continue;

    const dayRanges: TimeRange[] = assignment.shiftTemplate.ranges
      .filter((r) => r.dayOfWeek === dayOfWeek)
      .map((r) => ({ startTime: r.startTime, endTime: r.endTime }));

    if (dayRanges.length === 0) continue;

    const busyAppointments = await db.appointment.findMany({
      where: { workerId: worker.id, date: params.date, status: "CONFIRMED" },
    });
    const busyRanges: TimeRange[] = busyAppointments.map((a) => ({
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    const freeRanges = subtractBusyRanges(dayRanges, busyRanges);
    const slots = generateSlotStarts(freeRanges, service.durationMinutes);

    if (slots.length > 0) {
      results.push({ workerId: worker.id, workerName: `${worker.name} ${worker.lastName}`, slots });
    }
  }

  return results;
}
```

This requires a named unique constraint on `WorkerWeekAssignment`. Confirm `prisma/schema.prisma` already has `@@unique([workerId, weekStartDate])` from Task 2 — Prisma names the generated field `workerId_weekStartDate`, matching the `findUnique` call above.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/availability-service.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Add the API route**

```typescript
// src/app/api/availability/route.ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/availability-service.ts src/app/api/availability/route.ts tests/integration/availability-service.test.ts
git commit -m "feat: add DB-aware availability computation and /api/availability"
```

---

### Task 6: Appointment booking service (with race-condition safety)

**Files:**
- Create: `src/lib/appointments-service.ts`
- Create: `src/app/api/appointments/route.ts`
- Test: `tests/integration/appointments-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `getAvailableSlots` (Task 5)
- Produces: `createAppointment(params): Promise<CreateAppointmentResult>` and `listAppointmentsForUser(userId, role): Promise<Appointment[]>` — consumed by the `/api/appointments` route (this task) and later by client/worker/admin UI (Tasks 15-17).

- [ ] **Step 1: Write the failing integration tests**

```typescript
// tests/integration/appointments-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { createAppointment } from "@/lib/appointments-service";

async function seedBasicFixture() {
  const worker = await testDb.user.create({
    data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
  });
  const client = await testDb.user.create({
    data: { email: "client@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
  });
  const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
  const shift = await testDb.shiftTemplate.create({
    data: {
      name: "Turno mañana",
      ranges: { create: [{ dayOfWeek: 1, startTime: "08:00", endTime: "16:00" }] }, // Tuesday
    },
  });
  const monday = new Date("2026-07-06T00:00:00Z");
  await testDb.workerWeekAssignment.create({
    data: { workerId: worker.id, weekStartDate: monday, shiftTemplateId: shift.id },
  });
  return { worker, client, service, tuesday: new Date("2026-07-07T00:00:00Z") };
}

describe("createAppointment", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a CONFIRMED appointment for an available slot", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const result = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "08:00",
        createdBy: "CLIENT",
      },
      testDb
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appointment.status).toBe("CONFIRMED");
      expect(result.appointment.endTime).toBe("08:30");
    }
  });

  it("rejects a slot outside the worker's shift", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const result = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "18:00",
        createdBy: "CLIENT",
      },
      testDb
    );

    expect(result).toEqual({ ok: false, reason: "SLOT_UNAVAILABLE" });
  });

  it("rejects a second booking for the same worker/date/time", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const first = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "09:00",
        createdBy: "CLIENT",
      },
      testDb
    );
    expect(first.ok).toBe(true);

    const second = await createAppointment(
      {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tuesday,
        startTime: "09:00",
        createdBy: "CLIENT",
      },
      testDb
    );
    expect(second).toEqual({ ok: false, reason: "SLOT_UNAVAILABLE" });
  });

  it("allows exactly one of two concurrent bookings for the same slot to succeed", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();

    const [a, b] = await Promise.all([
      createAppointment(
        { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "10:00", createdBy: "CLIENT" },
        testDb
      ),
      createAppointment(
        { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "10:00", createdBy: "CLIENT" },
        testDb
      ),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/appointments-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/appointments-service'`.

- [ ] **Step 3: Implement the appointments service**

```typescript
// src/lib/appointments-service.ts
import type { Appointment, PrismaClient, Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability-service";
import { timeToMinutes, minutesToTime } from "@/lib/availability";

export type CreateAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; reason: "SLOT_UNAVAILABLE" };

export async function createAppointment(
  params: {
    clientId: string;
    workerId: string;
    serviceId: string;
    date: Date;
    startTime: string;
    createdBy: "CLIENT" | "STAFF";
  },
  db: PrismaClient = defaultPrisma
): Promise<CreateAppointmentResult> {
  try {
    return await db.$transaction(async (tx) => {
      const service = await tx.service.findUniqueOrThrow({ where: { id: params.serviceId } });
      const available = await getAvailableSlots(
        { serviceId: params.serviceId, date: params.date, workerId: params.workerId },
        tx as unknown as PrismaClient
      );
      const workerSlots = available.find((a) => a.workerId === params.workerId)?.slots ?? [];
      if (!workerSlots.includes(params.startTime)) {
        return { ok: false, reason: "SLOT_UNAVAILABLE" } as const;
      }

      const endTime = minutesToTime(timeToMinutes(params.startTime) + service.durationMinutes);
      const appointment = await tx.appointment.create({
        data: {
          clientId: params.clientId,
          workerId: params.workerId,
          serviceId: params.serviceId,
          date: params.date,
          startTime: params.startTime,
          endTime,
          createdBy: params.createdBy,
        },
      });

      return { ok: true, appointment } as const;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "SLOT_UNAVAILABLE" };
    }
    throw err;
  }
}

export async function listAppointmentsForUser(
  userId: string,
  role: Role,
  db: PrismaClient = defaultPrisma
): Promise<Appointment[]> {
  if (role === "ADMIN") {
    return db.appointment.findMany({ orderBy: { date: "asc" } });
  }
  if (role === "WORKER") {
    return db.appointment.findMany({ where: { workerId: userId }, orderBy: { date: "asc" } });
  }
  return db.appointment.findMany({ where: { clientId: userId }, orderBy: { date: "asc" } });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/appointments-service.test.ts
```

Expected: all 4 tests PASS. The concurrency test relies on the partial unique index from Task 2 — if it fails with both bookings succeeding, re-check that the index exists (`\d "Appointment"` in psql).

- [ ] **Step 5: Add the API route**

```typescript
// src/app/api/appointments/route.ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/appointments-service.ts src/app/api/appointments/route.ts tests/integration/appointments-service.test.ts
git commit -m "feat: add appointment booking service with race-condition safety"
```

---

### Task 7: Appointment cancellation

**Files:**
- Modify: `src/lib/appointments-service.ts` (add `cancelAppointment`)
- Create: `src/app/api/appointments/[id]/route.ts`
- Modify: `tests/integration/appointments-service.test.ts` (add cancellation tests)

**Interfaces:**
- Consumes: `prisma` (Task 2)
- Produces: `cancelAppointment(params: { appointmentId: string; actingUserId: string; actingUserRole: Role }): Promise<CancelAppointmentResult>` — consumed by the `PATCH` route here and by worker/admin UI in Tasks 16-17.

- [ ] **Step 1: Write the failing tests**

Append to `tests/integration/appointments-service.test.ts`:

```typescript
import { cancelAppointment } from "@/lib/appointments-service";

describe("cancelAppointment", () => {
  beforeEach(resetDatabase);

  it("lets the owning client cancel their own appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: client.id, actingUserRole: "CLIENT" },
      testDb
    );

    expect(result).toEqual({ ok: true });
    const updated = await testDb.appointment.findUniqueOrThrow({ where: { id: created.appointment.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("forbids a different client from cancelling someone else's appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const otherClient = await testDb.user.create({
      data: { email: "other@example.com", role: "CLIENT", name: "Otro", lastName: "Cliente" },
    });
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: otherClient.id, actingUserRole: "CLIENT" },
      testDb
    );

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("lets an admin cancel any appointment", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const admin = await testDb.user.create({
      data: { email: "admin2@example.com", role: "ADMIN", name: "Admin", lastName: "Uno" },
    });
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: admin.id, actingUserRole: "ADMIN" },
      testDb
    );

    expect(result).toEqual({ ok: true });
  });

  it("frees the slot after cancellation so it can be booked again", async () => {
    const { worker, client, service, tuesday } = await seedBasicFixture();
    const created = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    if (!created.ok) throw new Error("setup failed");

    await cancelAppointment(
      { appointmentId: created.appointment.id, actingUserId: client.id, actingUserRole: "CLIENT" },
      testDb
    );

    const rebooked = await createAppointment(
      { clientId: client.id, workerId: worker.id, serviceId: service.id, date: tuesday, startTime: "08:00", createdBy: "CLIENT" },
      testDb
    );
    expect(rebooked.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/appointments-service.test.ts
```

Expected: FAIL — `cancelAppointment is not a function`.

- [ ] **Step 3: Implement cancelAppointment**

Append to `src/lib/appointments-service.ts`:

```typescript
export type CancelAppointmentResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" };

export async function cancelAppointment(
  params: { appointmentId: string; actingUserId: string; actingUserRole: Role },
  db: PrismaClient = defaultPrisma
): Promise<CancelAppointmentResult> {
  const appointment = await db.appointment.findUnique({ where: { id: params.appointmentId } });
  if (!appointment) return { ok: false, reason: "NOT_FOUND" };

  const isOwningClient = params.actingUserRole === "CLIENT" && appointment.clientId === params.actingUserId;
  const isOwningWorker = params.actingUserRole === "WORKER" && appointment.workerId === params.actingUserId;
  const isAdmin = params.actingUserRole === "ADMIN";

  if (!isOwningClient && !isOwningWorker && !isAdmin) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  await db.appointment.update({
    where: { id: params.appointmentId },
    data: { status: "CANCELLED" },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/appointments-service.test.ts
```

Expected: all tests (booking + cancellation) PASS.

- [ ] **Step 5: Add the API route**

```typescript
// src/app/api/appointments/[id]/route.ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/appointments-service.ts src/app/api/appointments/[id]/route.ts tests/integration/appointments-service.test.ts
git commit -m "feat: add appointment cancellation with role-based authorization"
```

---

### Task 8: Admin — services CRUD

**Files:**
- Create: `src/lib/services-service.ts`
- Create: `src/app/api/admin/services/route.ts`
- Create: `src/app/api/admin/services/[id]/route.ts`
- Test: `tests/integration/services-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2)
- Produces: `listServices`, `createService`, `updateService` — consumed by the API routes here and by the admin services UI page (Task 17).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/integration/services-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { listServices, createService, updateService } from "@/lib/services-service";

describe("services-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates and lists active services", async () => {
    await createService({ name: "Corte", durationMinutes: 30 }, testDb);
    await createService({ name: "Corte + Barba", durationMinutes: 60 }, testDb);

    const services = await listServices(testDb);
    expect(services.map((s) => s.name).sort()).toEqual(["Corte", "Corte + Barba"]);
  });

  it("updates a service's duration and active flag", async () => {
    const created = await createService({ name: "Tinte", durationMinutes: 60 }, testDb);

    const updated = await updateService(created.id, { durationMinutes: 30, active: false }, testDb);

    expect(updated.durationMinutes).toBe(30);
    expect(updated.active).toBe(false);
  });

  it("excludes inactive services from listServices by default", async () => {
    const created = await createService({ name: "Descontinuado", durationMinutes: 30 }, testDb);
    await updateService(created.id, { active: false }, testDb);

    const services = await listServices(testDb);
    expect(services.find((s) => s.id === created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/services-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services-service'`.

- [ ] **Step 3: Implement the services service**

```typescript
// src/lib/services-service.ts
import type { PrismaClient, Service } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export function listServices(db: PrismaClient = defaultPrisma): Promise<Service[]> {
  return db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function createService(
  input: { name: string; durationMinutes: number },
  db: PrismaClient = defaultPrisma
): Promise<Service> {
  return db.service.create({ data: input });
}

export function updateService(
  id: string,
  input: { name?: string; durationMinutes?: number; active?: boolean },
  db: PrismaClient = defaultPrisma
): Promise<Service> {
  return db.service.update({ where: { id }, data: input });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/services-service.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Add the API routes**

```typescript
// src/app/api/admin/services/route.ts
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
```

```typescript
// src/app/api/admin/services/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateService } from "@/lib/services-service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const service = await updateService(params.id, body);
  return NextResponse.json(service);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/services-service.ts src/app/api/admin/services tests/integration/services-service.test.ts
git commit -m "feat: add admin services CRUD"
```

---

### Task 9: Admin — shift templates CRUD

**Files:**
- Create: `src/lib/shift-templates-service.ts`
- Create: `src/app/api/admin/shift-templates/route.ts`
- Create: `src/app/api/admin/shift-templates/[id]/route.ts`
- Test: `tests/integration/shift-templates-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2)
- Produces: `listShiftTemplates`, `createShiftTemplate(input: { name: string; isVacation?: boolean; ranges: Array<{ dayOfWeek: number; startTime: string; endTime: string }> })`, `updateShiftTemplateRanges(id, ranges)` — consumed by API routes here, by `worker-assignments-service.ts` (Task 10), and by the admin UI (Task 17).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/integration/shift-templates-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import {
  listShiftTemplates,
  createShiftTemplate,
  updateShiftTemplateRanges,
} from "@/lib/shift-templates-service";

describe("shift-templates-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a shift template with per-day ranges, including a split shift", async () => {
    const shift = await createShiftTemplate(
      {
        name: "Turno partido",
        ranges: [
          { dayOfWeek: 0, startTime: "10:00", endTime: "14:00" },
          { dayOfWeek: 0, startTime: "16:00", endTime: "20:00" },
        ],
      },
      testDb
    );

    const [withRanges] = await listShiftTemplates(testDb);
    expect(withRanges.ranges).toHaveLength(2);
    expect(shift.name).toBe("Turno partido");
  });

  it("creates a vacation template with no ranges", async () => {
    const shift = await createShiftTemplate({ name: "Vacaciones", isVacation: true, ranges: [] }, testDb);
    expect(shift.isVacation).toBe(true);
  });

  it("replaces a template's ranges entirely on update", async () => {
    const shift = await createShiftTemplate(
      { name: "Turno mañana", ranges: [{ dayOfWeek: 0, startTime: "08:00", endTime: "16:00" }] },
      testDb
    );

    await updateShiftTemplateRanges(
      shift.id,
      [{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }],
      testDb
    );

    const [updated] = await listShiftTemplates(testDb);
    expect(updated.ranges).toEqual([
      expect.objectContaining({ startTime: "09:00", endTime: "17:00" }),
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/shift-templates-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/shift-templates-service'`.

- [ ] **Step 3: Implement the shift templates service**

```typescript
// src/lib/shift-templates-service.ts
import type { PrismaClient, ShiftTemplate, ShiftTemplateRange } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type ShiftTemplateWithRanges = ShiftTemplate & { ranges: ShiftTemplateRange[] };
type RangeInput = { dayOfWeek: number; startTime: string; endTime: string };

export function listShiftTemplates(
  db: PrismaClient = defaultPrisma
): Promise<ShiftTemplateWithRanges[]> {
  return db.shiftTemplate.findMany({ include: { ranges: true }, orderBy: { name: "asc" } });
}

export function createShiftTemplate(
  input: { name: string; isVacation?: boolean; ranges: RangeInput[] },
  db: PrismaClient = defaultPrisma
): Promise<ShiftTemplate> {
  return db.shiftTemplate.create({
    data: {
      name: input.name,
      isVacation: input.isVacation ?? false,
      ranges: { create: input.ranges },
    },
  });
}

export async function updateShiftTemplateRanges(
  id: string,
  ranges: RangeInput[],
  db: PrismaClient = defaultPrisma
): Promise<void> {
  await db.$transaction([
    db.shiftTemplateRange.deleteMany({ where: { shiftTemplateId: id } }),
    db.shiftTemplateRange.createMany({ data: ranges.map((r) => ({ ...r, shiftTemplateId: id })) }),
  ]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/shift-templates-service.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Add the API routes**

```typescript
// src/app/api/admin/shift-templates/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listShiftTemplates, createShiftTemplate } from "@/lib/shift-templates-service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json(await listShiftTemplates());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await request.json();
  const shift = await createShiftTemplate(body);
  return NextResponse.json(shift, { status: 201 });
}
```

```typescript
// src/app/api/admin/shift-templates/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateShiftTemplateRanges } from "@/lib/shift-templates-service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await request.json();
  await updateShiftTemplateRanges(params.id, body.ranges);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/shift-templates-service.ts src/app/api/admin/shift-templates tests/integration/shift-templates-service.test.ts
git commit -m "feat: add admin shift templates CRUD"
```

---

### Task 10: Admin — bulk worker week assignments

**Files:**
- Create: `src/lib/worker-assignments-service.ts`
- Create: `src/app/api/admin/worker-assignments/route.ts`
- Test: `tests/integration/worker-assignments-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `getMondayOfWeek` (Task 3)
- Produces: `assignWeeksToWorker(input: { workerId: string; shiftTemplateId: string; weekStartDates: Date[] }): Promise<WorkerWeekAssignment[]>` (upserts, so re-running for the same week overwrites the previous shift) — consumed by the API route here and by the admin assignments UI (Task 17).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/integration/worker-assignments-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { assignWeeksToWorker } from "@/lib/worker-assignments-service";

describe("assignWeeksToWorker", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("assigns the same shift template to several consecutive weeks at once", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const shift = await testDb.shiftTemplate.create({ data: { name: "Turno partido" } });
    const weeks = [
      new Date("2026-07-06T00:00:00Z"),
      new Date("2026-07-13T00:00:00Z"),
      new Date("2026-07-20T00:00:00Z"),
    ];

    const assignments = await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: shift.id, weekStartDates: weeks },
      testDb
    );

    expect(assignments).toHaveLength(3);
    const stored = await testDb.workerWeekAssignment.findMany({ where: { workerId: worker.id } });
    expect(stored).toHaveLength(3);
  });

  it("overwrites an existing assignment for a week that was already set", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker2@example.com", role: "WORKER", name: "Marta", lastName: "Ruiz" },
    });
    const morning = await testDb.shiftTemplate.create({ data: { name: "Turno mañana" } });
    const afternoon = await testDb.shiftTemplate.create({ data: { name: "Turno tarde" } });
    const week = new Date("2026-07-06T00:00:00Z");

    await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: morning.id, weekStartDates: [week] },
      testDb
    );
    await assignWeeksToWorker(
      { workerId: worker.id, shiftTemplateId: afternoon.id, weekStartDates: [week] },
      testDb
    );

    const stored = await testDb.workerWeekAssignment.findMany({ where: { workerId: worker.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].shiftTemplateId).toBe(afternoon.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/worker-assignments-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/worker-assignments-service'`.

- [ ] **Step 3: Implement the service**

```typescript
// src/lib/worker-assignments-service.ts
import type { PrismaClient, WorkerWeekAssignment } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export async function assignWeeksToWorker(
  input: { workerId: string; shiftTemplateId: string; weekStartDates: Date[] },
  db: PrismaClient = defaultPrisma
): Promise<WorkerWeekAssignment[]> {
  return Promise.all(
    input.weekStartDates.map((weekStartDate) =>
      db.workerWeekAssignment.upsert({
        where: { workerId_weekStartDate: { workerId: input.workerId, weekStartDate } },
        update: { shiftTemplateId: input.shiftTemplateId },
        create: {
          workerId: input.workerId,
          weekStartDate,
          shiftTemplateId: input.shiftTemplateId,
        },
      })
    )
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/worker-assignments-service.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Add the API route**

```typescript
// src/app/api/admin/worker-assignments/route.ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/worker-assignments-service.ts src/app/api/admin/worker-assignments tests/integration/worker-assignments-service.test.ts
git commit -m "feat: add bulk weekly shift assignment for workers"
```

---

### Task 11: Admin — create worker accounts

**Files:**
- Create: `src/lib/workers-service.ts`
- Create: `src/app/api/admin/workers/route.ts`
- Test: `tests/integration/workers-service.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (Task 4), `prisma` (Task 2)
- Produces: `createWorker(input: { email: string; password: string; name: string; lastName: string; phone?: string }): Promise<User>`, `listWorkers()` — consumed by the API route here and the admin workers UI (Task 17).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/integration/workers-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { createWorker, listWorkers } from "@/lib/workers-service";
import { verifyPassword } from "@/lib/password";

describe("workers-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("creates a WORKER account with a hashed password", async () => {
    const worker = await createWorker(
      { email: "nuevo@example.com", password: "clave-segura-1", name: "Iker", lastName: "Sola" },
      testDb
    );

    expect(worker.role).toBe("WORKER");
    expect(await verifyPassword("clave-segura-1", worker.passwordHash!)).toBe(true);
  });

  it("lists all workers", async () => {
    await createWorker({ email: "w1@example.com", password: "clave-segura-1", name: "A", lastName: "B" }, testDb);
    await createWorker({ email: "w2@example.com", password: "clave-segura-1", name: "C", lastName: "D" }, testDb);

    const workers = await listWorkers(testDb);
    expect(workers).toHaveLength(2);
  });

  it("rejects creating a worker with an email already in use", async () => {
    await createWorker({ email: "dup@example.com", password: "clave-segura-1", name: "A", lastName: "B" }, testDb);

    await expect(
      createWorker({ email: "dup@example.com", password: "otra-clave", name: "C", lastName: "D" }, testDb)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/workers-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/workers-service'`.

- [ ] **Step 3: Implement the service**

```typescript
// src/lib/workers-service.ts
import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function createWorker(
  input: { email: string; password: string; name: string; lastName: string; phone?: string },
  db: PrismaClient = defaultPrisma
): Promise<User> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");

  return db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "WORKER",
      name: input.name,
      lastName: input.lastName,
      phone: input.phone,
    },
  });
}

export function listWorkers(db: PrismaClient = defaultPrisma): Promise<User[]> {
  return db.user.findMany({ where: { role: "WORKER" }, orderBy: { name: "asc" } });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/workers-service.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Add the API route**

```typescript
// src/app/api/admin/workers/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createWorker, listWorkers } from "@/lib/workers-service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json(await listWorkers());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const worker = await createWorker(body);
    return NextResponse.json(worker, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }
    throw err;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/workers-service.ts src/app/api/admin/workers tests/integration/workers-service.test.ts
git commit -m "feat: let admin create worker accounts"
```

---

### Task 12: Email notifications (confirmation and cancellation)

**Files:**
- Create: `src/lib/email.ts`
- Modify: `src/app/api/appointments/route.ts` (send confirmation after create)
- Modify: `src/app/api/appointments/[id]/route.ts` (send cancellation email)
- Test: `tests/unit/email.test.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM` env vars
- Produces: `sendAppointmentConfirmation(to, details)`, `sendAppointmentCancellation(to, details)`, `sendAppointmentReminder(to, details)` — the last one is consumed by the cron job in Task 13.

- [ ] **Step 1: Write the failing unit test (with a mocked Resend client)**

```typescript
// tests/unit/email.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ id: "email_123" });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { sendAppointmentConfirmation, sendAppointmentCancellation } from "@/lib/email";

describe("email notifications", () => {
  beforeEach(() => sendMock.mockClear());

  it("sends a confirmation email with the appointment details in the body", async () => {
    await sendAppointmentConfirmation("cliente@example.com", {
      serviceName: "Corte",
      workerName: "Luis Gómez",
      date: "2026-07-07",
      startTime: "08:00",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("cliente@example.com");
    expect(call.subject).toContain("Confirmación");
    expect(call.html).toContain("Corte");
    expect(call.html).toContain("Luis Gómez");
  });

  it("sends a cancellation email", async () => {
    await sendAppointmentCancellation("cliente@example.com", {
      serviceName: "Corte",
      workerName: "Luis Gómez",
      date: "2026-07-07",
      startTime: "08:00",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].subject).toContain("Cancelación");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/email.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/email'`.

- [ ] **Step 3: Implement the email module**

```typescript
// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "citas@example.com";

export interface AppointmentEmailDetails {
  serviceName: string;
  workerName: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
}

export async function sendAppointmentConfirmation(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Confirmación de tu cita",
    html: `<p>Tu cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> quedó confirmada para el ${details.date} a las ${details.startTime}.</p>`,
  });
}

export async function sendAppointmentCancellation(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Cancelación de tu cita",
    html: `<p>Tu cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> del ${details.date} a las ${details.startTime} fue cancelada.</p>`,
  });
}

export async function sendAppointmentReminder(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Recordatorio de tu cita mañana",
    html: `<p>Recordatorio: tienes una cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> el ${details.date} a las ${details.startTime}.</p>`,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/email.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Wire the confirmation email into booking**

In `src/app/api/appointments/route.ts`, after `const result = await createAppointment(...)` succeeds, add:

```typescript
import { sendAppointmentConfirmation } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// ... inside POST, after `if (!result.ok) { ... }` and before the final return:
const [client, worker, service] = await Promise.all([
  prisma.user.findUniqueOrThrow({ where: { id: result.appointment.clientId } }),
  prisma.user.findUniqueOrThrow({ where: { id: result.appointment.workerId } }),
  prisma.service.findUniqueOrThrow({ where: { id: result.appointment.serviceId } }),
]);
await sendAppointmentConfirmation(client.email, {
  serviceName: service.name,
  workerName: `${worker.name} ${worker.lastName}`,
  date: result.appointment.date.toISOString().slice(0, 10),
  startTime: result.appointment.startTime,
});
```

- [ ] **Step 6: Wire the cancellation email into cancellation**

In `src/app/api/appointments/[id]/route.ts`, after a successful `cancelAppointment` call, fetch the same three related records and call `sendAppointmentCancellation` the same way, before returning `{ ok: true }`.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS (the appointments route itself isn't unit-tested at the HTTP layer, so this won't break the Task 6/7 service-level tests — the email call only happens inside the route handler).

- [ ] **Step 8: Commit**

```bash
git add src/lib/email.ts src/app/api/appointments tests/unit/email.test.ts
git commit -m "feat: send confirmation and cancellation emails via Resend"
```

---

### Task 13: Reminder cron job

**Files:**
- Create: `src/app/api/cron/reminders/route.ts`
- Test: `tests/integration/reminders.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `sendAppointmentReminder` (Task 12)
- Produces: `findAppointmentsNeedingReminder(now: Date, db): Promise<Appointment[]>` (exported from the route module for testability) — this is the last task in the notifications chain; nothing downstream depends on it.

- [ ] **Step 1: Write the failing integration test**

```typescript
// tests/integration/reminders.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { findAppointmentsNeedingReminder } from "@/app/api/cron/reminders/route";

describe("findAppointmentsNeedingReminder", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("finds a CONFIRMED appointment exactly one day from now", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const tomorrow = new Date("2026-07-07T00:00:00Z");

    const appointment = await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tomorrow,
        startTime: "10:00",
        endTime: "10:30",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found.map((a) => a.id)).toContain(appointment.id);
  });

  it("does not return an appointment that is 3 days away", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker2@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client2@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const inThreeDays = new Date("2026-07-09T00:00:00Z");

    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: inThreeDays,
        startTime: "10:00",
        endTime: "10:30",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found).toHaveLength(0);
  });

  it("does not return a CANCELLED appointment", async () => {
    const worker = await testDb.user.create({
      data: { email: "worker3@example.com", role: "WORKER", name: "Luis", lastName: "Gómez" },
    });
    const client = await testDb.user.create({
      data: { email: "client3@example.com", role: "CLIENT", name: "Ana", lastName: "Ruiz" },
    });
    const service = await testDb.service.create({ data: { name: "Corte", durationMinutes: 30 } });
    const now = new Date("2026-07-06T10:00:00Z");
    const tomorrow = new Date("2026-07-07T00:00:00Z");

    await testDb.appointment.create({
      data: {
        clientId: client.id,
        workerId: worker.id,
        serviceId: service.id,
        date: tomorrow,
        startTime: "10:00",
        endTime: "10:30",
        status: "CANCELLED",
        createdBy: "CLIENT",
      },
    });

    const found = await findAppointmentsNeedingReminder(now, testDb);
    expect(found).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/reminders.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/cron/reminders/route'` (or no exported `findAppointmentsNeedingReminder`).

- [ ] **Step 3: Implement the cron route**

`Appointment.date` only ever stores a calendar day at UTC midnight (the time-of-day lives in `startTime`), so "remind the day before" is a same-day match against tomorrow's midnight, not an hour-precision sliding window — a window would almost always miss, since it'd be comparing an hour-of-day range against a field that's always exactly `00:00`.

```typescript
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
```

Document in `.env.example` that `CRON_SECRET` must be set and that the business's hosting provider (e.g. Vercel Cron) should call this route once a day (e.g. every morning) — calling it more than once on the same day just re-sends the same reminders, since there's no "already reminded" flag in the MVP.

- [ ] **Step 4: Add `CRON_SECRET` to the env template**

Append to `.env.example`:

```bash
CRON_SECRET="replace-with-a-random-string"
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/integration/reminders.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/reminders/route.ts tests/integration/reminders.test.ts .env.example
git commit -m "feat: add appointment reminder cron endpoint"
```

---

### Task 14: Client UI — login and registration pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `signIn` from `next-auth/react`, `POST /api/auth/register` (Task 4)
- Produces: working `/login` and `/register` pages that every other UI task links to.

- [ ] **Step 1: Build the login page**

```tsx
// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push("/");
  }

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Entrar</button>
      </form>
      <button onClick={() => signIn("google")}>Continuar con Google</button>
      <p>
        ¿No tienes cuenta? <a href="/register">Regístrate</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Build the registration page**

```tsx
// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo registrar");
      return;
    }
    router.push("/login");
  }

  return (
    <main>
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          Apellidos
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Teléfono
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Registrarme</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Add the SessionProvider wrapper so `signIn`/`useSession` work**

```tsx
// src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Modify `src/app/layout.tsx` to wrap `{children}` with `<Providers>`:

```tsx
import { Providers } from "./providers";
// ...inside the <body>:
<Providers>{children}</Providers>
```

- [ ] **Step 4: Manually verify in the browser**

```bash
npm run dev
```

Visit `http://localhost:3000/register`, create a client account, then visit `/login` and sign in with it. Expected: redirected to `/` after login with no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/login src/app/register src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: add login and registration pages"
```

---

### Task 15: Client UI — booking flow and my-appointments page

**Files:**
- Create: `src/app/book/page.tsx`
- Create: `src/app/my-appointments/page.tsx`

**Interfaces:**
- Consumes: `GET /api/availability`, `POST /api/appointments`, `GET /api/appointments`, `PATCH /api/appointments/[id]` (Tasks 5-7), `useSession` from `next-auth/react`
- Produces: the pages a logged-in client uses end to end; nothing downstream depends on these.

- [ ] **Step 1: Build the booking page**

```tsx
// src/app/book/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}
interface WorkerAvailability {
  workerId: string;
  workerName: string;
  slots: string[];
}

export default function BookPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState<WorkerAvailability[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/services")
      .then((res) => res.json())
      .then(setServices);
  }, []);

  useEffect(() => {
    if (!serviceId || !date) {
      setAvailability([]);
      return;
    }
    fetch(`/api/availability?serviceId=${serviceId}&date=${date}`)
      .then((res) => res.json())
      .then(setAvailability);
  }, [serviceId, date]);

  async function book(workerId: string, startTime: string) {
    setMessage(null);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, serviceId, date, startTime }),
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "No se pudo reservar");
      return;
    }
    setMessage("¡Cita reservada!");
    setAvailability((prev) =>
      prev.map((w) => (w.workerId === workerId ? { ...w, slots: w.slots.filter((s) => s !== startTime) } : w))
    );
  }

  return (
    <main>
      <h1>Reservar cita</h1>
      <label>
        Servicio
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Selecciona un servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMinutes} min)
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {message && <p role="status">{message}</p>}

      {availability.map((worker) => (
        <section key={worker.workerId}>
          <h2>{worker.workerName}</h2>
          <ul>
            {worker.slots.map((slot) => (
              <li key={slot}>
                <button onClick={() => book(worker.workerId, slot)}>{slot}</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Build the my-appointments page**

```tsx
// src/app/my-appointments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  serviceId: string;
  workerId: string;
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  function load() {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then(setAppointments);
  }

  useEffect(load, []);

  async function cancel(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    load();
  }

  return (
    <main>
      <h1>Mis citas</h1>
      <ul>
        {appointments.map((a) => (
          <li key={a.id}>
            {a.date.slice(0, 10)} {a.startTime}-{a.endTime} — {a.status}
            {a.status === "CONFIRMED" && <button onClick={() => cancel(a.id)}>Cancelar</button>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

With the dev server running and logged in as a client (Task 14), seed a worker + shift assignment via `npx prisma studio` or the admin API (Tasks 9-11) once built, then visit `/book`, pick a service/date, and confirm a slot appears and can be booked. Then visit `/my-appointments` and cancel it. Expected: the cancelled appointment shows `CANCELLED` and its slot reappears on `/book`.

- [ ] **Step 4: Commit**

```bash
git add src/app/book src/app/my-appointments
git commit -m "feat: add client booking flow and my-appointments page"
```

---

### Task 16: Worker UI — agenda dashboard

**Files:**
- Create: `src/app/worker/page.tsx`

**Interfaces:**
- Consumes: `GET /api/appointments` (returns only this worker's appointments per `listAppointmentsForUser`, Task 6), `PATCH /api/appointments/[id]` (Task 7)
- Produces: the worker-facing dashboard; nothing downstream depends on it.

- [ ] **Step 1: Build the worker dashboard**

```tsx
// src/app/worker/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  clientId: string;
  serviceId: string;
}

export default function WorkerDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  function load() {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then(setAppointments);
  }

  useEffect(load, []);

  async function cancel(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    load();
  }

  const upcoming = appointments.filter((a) => a.status === "CONFIRMED");

  return (
    <main>
      <h1>Mi agenda</h1>
      <ul>
        {upcoming.map((a) => (
          <li key={a.id}>
            {a.date.slice(0, 10)} {a.startTime}-{a.endTime}
            <button onClick={() => cancel(a.id)}>Cancelar</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Log in as a worker account (create one via the admin API from Task 11, or directly in `prisma studio`), visit `/worker`, and confirm only that worker's appointments show up, and cancelling one updates the list.

- [ ] **Step 3: Commit**

```bash
git add src/app/worker
git commit -m "feat: add worker agenda dashboard"
```

---

### Task 17: Admin UI — services, shift templates, assignments, workers, appointments

**Files:**
- Create: `src/app/admin/services/page.tsx`
- Create: `src/app/admin/shift-templates/page.tsx`
- Create: `src/app/admin/assignments/page.tsx`
- Create: `src/app/admin/workers/page.tsx`
- Create: `src/app/admin/appointments/page.tsx`

**Interfaces:**
- Consumes: all `/api/admin/*` routes (Tasks 8-11) and `/api/appointments` (Task 6-7)
- Produces: the full admin control surface; terminal task, nothing downstream depends on it.

- [ ] **Step 1: Build the services management page**

```tsx
// src/app/admin/services/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);

  function load() {
    fetch("/api/admin/services")
      .then((res) => res.json())
      .then(setServices);
  }
  useEffect(load, []);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, durationMinutes }),
    });
    setName("");
    load();
  }

  async function toggleActive(service: Service) {
    await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !service.active }),
    });
    load();
  }

  return (
    <main>
      <h1>Servicios</h1>
      <form onSubmit={addService}>
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
        <button type="submit">Agregar</button>
      </form>
      <ul>
        {services.map((s) => (
          <li key={s.id}>
            {s.name} ({s.durationMinutes} min) — {s.active ? "activo" : "inactivo"}
            <button onClick={() => toggleActive(s)}>{s.active ? "Desactivar" : "Activar"}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Build the shift templates management page**

```tsx
// src/app/admin/shift-templates/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Range {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
interface ShiftTemplate {
  id: string;
  name: string;
  isVacation: boolean;
  ranges: Range[];
}

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function AdminShiftTemplatesPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [name, setName] = useState("");
  const [isVacation, setIsVacation] = useState(false);
  const [ranges, setRanges] = useState<Range[]>([]);

  function load() {
    fetch("/api/admin/shift-templates")
      .then((res) => res.json())
      .then(setTemplates);
  }
  useEffect(load, []);

  function addRangeRow() {
    setRanges([...ranges, { dayOfWeek: 0, startTime: "08:00", endTime: "16:00" }]);
  }

  function updateRange(index: number, patch: Partial<Range>) {
    setRanges(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/shift-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isVacation, ranges: isVacation ? [] : ranges }),
    });
    setName("");
    setRanges([]);
    setIsVacation(false);
    load();
  }

  return (
    <main>
      <h1>Turnos</h1>
      <form onSubmit={createTemplate}>
        <input placeholder="Nombre del turno" value={name} onChange={(e) => setName(e.target.value)} required />
        <label>
          <input type="checkbox" checked={isVacation} onChange={(e) => setIsVacation(e.target.checked)} />
          Es vacaciones (sin disponibilidad)
        </label>

        {!isVacation && (
          <>
            <button type="button" onClick={addRangeRow}>
              Agregar franja
            </button>
            {ranges.map((r, i) => (
              <div key={i}>
                <select value={r.dayOfWeek} onChange={(e) => updateRange(i, { dayOfWeek: Number(e.target.value) })}>
                  {DAY_LABELS.map((label, day) => (
                    <option key={day} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={r.startTime}
                  onChange={(e) => updateRange(i, { startTime: e.target.value })}
                />
                <input
                  type="time"
                  value={r.endTime}
                  onChange={(e) => updateRange(i, { endTime: e.target.value })}
                />
              </div>
            ))}
          </>
        )}
        <button type="submit">Crear turno</button>
      </form>

      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.name} {t.isVacation && "(vacaciones)"}
            <ul>
              {t.ranges.map((r, i) => (
                <li key={i}>
                  {DAY_LABELS[r.dayOfWeek]}: {r.startTime}-{r.endTime}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Build the weekly assignments page**

```tsx
// src/app/admin/assignments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Worker {
  id: string;
  name: string;
  lastName: string;
}
interface ShiftTemplate {
  id: string;
  name: string;
}

export default function AdminAssignmentsPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [shiftTemplateId, setShiftTemplateId] = useState("");
  const [firstWeek, setFirstWeek] = useState("");
  const [weekCount, setWeekCount] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/workers")
      .then((res) => res.json())
      .then(setWorkers);
    fetch("/api/admin/shift-templates")
      .then((res) => res.json())
      .then(setTemplates);
  }, []);

  function weekStartDates(): string[] {
    const dates: string[] = [];
    const start = new Date(`${firstWeek}T00:00:00.000Z`);
    for (let i = 0; i < weekCount; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i * 7);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/worker-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, shiftTemplateId, weekStartDates: weekStartDates() }),
    });
    setMessage(res.ok ? "Turnos asignados" : "Error al asignar");
  }

  return (
    <main>
      <h1>Asignar turnos semanales</h1>
      <form onSubmit={assign}>
        <label>
          Trabajador
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
            <option value="">Selecciona</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.lastName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Turno
          <select value={shiftTemplateId} onChange={(e) => setShiftTemplateId(e.target.value)} required>
            <option value="">Selecciona</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Primer lunes
          <input type="date" value={firstWeek} onChange={(e) => setFirstWeek(e.target.value)} required />
        </label>
        <label>
          Cantidad de semanas
          <input
            type="number"
            min={1}
            value={weekCount}
            onChange={(e) => setWeekCount(Number(e.target.value))}
          />
        </label>
        <button type="submit">Asignar</button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Build the workers management page**

```tsx
// src/app/admin/workers/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Worker {
  id: string;
  name: string;
  lastName: string;
  email: string;
}

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/workers")
      .then((res) => res.json())
      .then(setWorkers);
  }
  useEffect(load, []);

  async function createWorker(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear");
      return;
    }
    setForm({ name: "", lastName: "", email: "", phone: "", password: "" });
    load();
  }

  return (
    <main>
      <h1>Trabajadores</h1>
      <form onSubmit={createWorker}>
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Apellidos"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          placeholder="Contraseña inicial"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear trabajador</button>
      </form>
      <ul>
        {workers.map((w) => (
          <li key={w.id}>
            {w.name} {w.lastName} — {w.email}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Build the appointments overview page**

```tsx
// src/app/admin/appointments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  clientId: string;
  workerId: string;
  serviceId: string;
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  function load() {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then(setAppointments);
  }
  useEffect(load, []);

  async function cancel(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    load();
  }

  return (
    <main>
      <h1>Todas las citas</h1>
      <ul>
        {appointments.map((a) => (
          <li key={a.id}>
            {a.date.slice(0, 10)} {a.startTime}-{a.endTime} — {a.status}
            {a.status === "CONFIRMED" && <button onClick={() => cancel(a.id)}>Cancelar</button>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Manually verify the full admin flow in the browser**

Log in as the seeded admin (Task 2), then in order: create a service (`/admin/services`), create a shift template (`/admin/shift-templates`), create a worker (`/admin/workers`), assign that worker to a few weeks (`/admin/assignments`), and confirm on `/admin/appointments` that a booking made via `/book` (Task 15) shows up and can be cancelled from the admin side.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin
git commit -m "feat: add admin dashboard for services, shift templates, assignments, workers, and appointments"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Task 1), data model (Task 2), availability algorithm (Tasks 3, 5), booking + race-condition safety (Task 6), cancellation + role permissions (Task 7), admin CRUD for services/turnos/assignments/workers (Tasks 8-11), notifications (Tasks 12-13), all three role UIs (Tasks 14-17) — every spec section maps to at least one task.
- **Type consistency checked:** `createAppointment`/`cancelAppointment` result types match what the API routes in Tasks 6-7 destructure; `WorkerAvailability` shape from Task 5 matches what Task 6's `createAppointment` and Task 15's `/book` page consume; `session.user.role`/`session.user.id` typed once in Task 4 and reused unchanged everywhere else.
- **No placeholders:** every step has runnable code or an exact command with expected output.
