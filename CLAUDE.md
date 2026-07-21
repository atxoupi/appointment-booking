# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A traditional (no AI/LLM) full-stack appointment booking app for a single small business (initially a hair salon), built with Next.js 14 App Router + TypeScript, PostgreSQL via Prisma, NextAuth.js, and Resend for email. Single-tenant: one deployment per business, no tenant-scoping in the data model.

The original design and implementation plan (in Spanish) live in `docs/superpowers/specs/2026-07-10-appointment-booking-design.md` and `docs/superpowers/plans/2026-07-10-appointment-booking-implementation.md` — read these for the "why" behind data model and permission decisions.

## Commands

```bash
npm run db:up        # start local Postgres + test Postgres via Docker Compose
npm run dev           # start Next.js dev server
npm run build         # production build
npm run lint          # next lint
npm test              # run full Vitest suite once
npm run test:watch    # Vitest watch mode
npx vitest run tests/unit/availability.test.ts        # run a single test file
npx vitest run -t "removes slots already taken"       # run tests matching a name
npx prisma migrate dev       # create/apply a migration against DATABASE_URL
npx prisma db seed           # run prisma/seed.ts (creates the first ADMIN user)
```

Local Postgres runs via `docker-compose.yml`: `db` on port 5432 (dev, `DATABASE_URL`) and `test-db` on port 5433 (integration tests, `TEST_DATABASE_URL`). Both must be up before running integration tests.

## Architecture

**Layering:** business logic lives in plain TypeScript service modules under `src/lib/*-service.ts`. API routes under `src/app/api/**/route.ts` are thin wrappers: check the session/role via `getServerSession(authOptions)`, parse the request, call a service function, map the result to an HTTP response. This keeps booking/availability logic unit- and integration-testable without an HTTP server. When adding a feature, put the logic in a service module first and keep the route handler minimal.

**Data model (`prisma/schema.prisma`):** one `User` table unifies all three roles (`CLIENT`, `WORKER`, `ADMIN` — the `Role` enum) rather than separate tables. Clients self-register (credentials or Google OAuth); worker/admin accounts are only created by an admin or the seed script — there is no self-registration path for those roles.

Shift scheduling is modeled as reusable templates applied per week:
- `ShiftTemplate` — a named shift (e.g. "Turno mañana"), with `isVacation` marking a template that blocks all availability that week.
- `ShiftTemplateRange` — one or more `(dayOfWeek, startTime, endTime)` rows per template; a day with no rows means the template doesn't work that day (split shifts are multiple rows for the same day).
- `WorkerWeekAssignment` — assigns one `ShiftTemplate` to one worker for one `weekStartDate` (always a Monday). No row for a given week means the worker has no availability that week at all.

`Appointment` rows store `startTime`/`endTime` as `"HH:mm"` strings (not `DateTime`), alongside a separate `date`. `status` is `CONFIRMED | CANCELLED`; cancelling never deletes a row, it flips status (so slots free up and history is preserved). `createdBy` (`CLIENT | STAFF`) distinguishes self-service bookings from staff-entered ones, but both paths go through the same availability/booking logic.

**Race-condition safety:** concurrent bookings for the exact same `(workerId, date, startTime)` are prevented by a Postgres **partial unique index** on `Appointment` scoped to `status = 'CONFIRMED'` (see the hand-edited line at the end of `prisma/migrations/20260710134905_init/migration.sql` — this can't be expressed via `@@unique` in `schema.prisma` and must be re-added by hand after any `prisma migrate dev --create-only` touching this table). `createAppointment` in `src/lib/appointments-service.ts` re-validates availability inside a `$transaction` and catches the resulting Prisma `P2002` unique-violation error as an expected `SLOT_UNAVAILABLE` result, not a thrown error. Known gap (documented in the design doc): the index only catches identical `startTime` collisions, not partial overlaps between differently-sized services booked concurrently — accepted as low-risk for expected booking volume.

**Availability computation** is split into two layers:
- `src/lib/availability.ts` — pure, dependency-free time math (`timeToMinutes`/`minutesToTime`, `getMondayOfWeek`, `getDayOfWeekIndex`, `subtractBusyRanges`, `generateSlotStarts`). Covered by unit tests in `tests/unit/`.
- `src/lib/availability-service.ts` — `getAvailableSlots()`, the DB-aware layer: resolves each worker's `WorkerWeekAssignment` for the target week, pulls that day's `ShiftTemplateRange`s, subtracts existing `CONFIRMED` appointments, and generates slot start times. Every service function takes an optional `db: PrismaClient` parameter (defaulting to the shared singleton from `src/lib/prisma.ts`) so it can run against `tests/integration/setup.ts`'s `testDb`, and so `createAppointment` can pass its open `$transaction` client through to reuse the same availability check atomically.

**Auth:** `src/lib/auth.ts` configures NextAuth (JWT sessions) with Credentials (bcrypt via `src/lib/password.ts`) and Google providers. Google sign-in only ever logs into an *existing* user matched by email, or creates a new `CLIENT` — it never creates `WORKER`/`ADMIN` accounts. `session.user.role`/`.id` are populated via the `jwt`/`session` callbacks and typed through `src/lib/next-auth.d.ts`. `src/middleware.ts` does coarse role-based route protection (`/admin/*` → ADMIN, `/worker/*` → WORKER, `/book/*` and `/my-appointments/*` → CLIENT), redirecting to `/login`; API routes still re-check `session.user.role` themselves since middleware only guards page routes.

**Email** (`src/lib/email.ts`) wraps Resend for confirmation, cancellation, and reminder emails. The Resend client is constructed lazily (`getResendClient()`) so the module can be imported without `RESEND_API_KEY` set (e.g. in tests). `src/app/api/cron/reminders/route.ts` + `src/lib/reminders-service.ts` implement the 24h-ahead reminder job, intended to be hit by an external scheduler guarded by `CRON_SECRET`.

## Testing conventions

- `tests/unit/` — pure functions, no database (availability math, password hashing, email payload shape).
- `tests/integration/` — every `src/lib/*-service.ts` function is tested against a **real** Postgres test database (`tests/integration/setup.ts`'s `testDb`, pointed at `TEST_DATABASE_URL`), not mocks — the whole point of these services is correct interaction with the schema (shift lookups, unique constraints, transactions). `resetDatabase()` truncates all tables in FK-safe order and should run in `beforeEach`.
- `vitest.config.ts` sets `fileParallelism: false` deliberately: all integration test files share one Postgres instance, and `resetDatabase()` in one file would race with inserts from another file if run in parallel.
- New service functions must have integration test coverage against the test DB, per the implementation plan's stated constraint — this isn't optional test hygiene, it's how race conditions and constraint behavior (e.g. the partial unique index) actually get verified.
