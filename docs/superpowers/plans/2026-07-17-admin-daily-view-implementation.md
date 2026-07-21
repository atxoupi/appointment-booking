# Admin Daily View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la página plana de citas del admin por una vista con calendario mensual a la izquierda y cuadrícula horaria por empleado a la derecha.

**Architecture:** Nuevo endpoint `GET /api/admin/daily-view?date=YYYY-MM-DD` respaldado por una función de servicio `getDailyView` en `appointments-service.ts`. La página `/admin/appointments` pasa a ser un componente cliente con estado `selectedDate` que fetcha el endpoint y renderiza el calendario y la cuadrícula como subcomponentes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Tailwind CSS, Vitest (tests de integración contra Postgres real).

## Global Constraints

- Sin dependencias nuevas — solo Next.js, Tailwind y Prisma ya instalados.
- Tests de integración contra `TEST_DATABASE_URL` (postgres real), nunca mocks de DB.
- `fileParallelism: false` en vitest — no correr archivos de integración en paralelo.
- `beforeEach(resetDatabase)` en cada `describe` de integración.
- Rango horario fijo: 08:00–21:00 (franjas de 30 min: "08:00", "08:30", …, "20:30").
- Solo citas con `status = CONFIRMED` aparecen en la cuadrícula.
- Todos los workers aparecen en la respuesta del endpoint aunque no tengan citas ese día.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/appointments-service.ts` | Modificar | Añadir `getDailyView` y tipos `DailyViewWorker`/`DailyViewAppointment` |
| `src/app/api/admin/daily-view/route.ts` | Crear | Endpoint GET con auth ADMIN y query param `date` |
| `src/app/admin/appointments/page.tsx` | Reemplazar | Componente cliente con estado de fecha, fetch y layout |
| `src/app/admin/appointments/MonthCalendar.tsx` | Crear | Calendario mensual cuadrado, navegación prev/next |
| `src/app/admin/appointments/DayGrid.tsx` | Crear | Tabla horaria con rowSpan para citas multi-franja |
| `tests/integration/appointments-service.test.ts` | Modificar | Añadir `describe("getDailyView", ...)` al final |

---

## Task 1: Servicio `getDailyView` + tipos

**Files:**
- Modify: `src/lib/appointments-service.ts`
- Test: `tests/integration/appointments-service.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface DailyViewAppointment {
    id: string;
    startTime: string;
    endTime: string;
    clientName: string;
    serviceName: string;
  }

  export interface DailyViewWorker {
    id: string;
    name: string;
    appointments: DailyViewAppointment[];
  }

  export async function getDailyView(
    date: Date,
    db?: PrismaClient
  ): Promise<DailyViewWorker[]>
  ```

- [ ] **Step 1: Escribir los tests de integración que deben fallar**

En `tests/integration/appointments-service.test.ts`:
1. Modificar la línea de import existente para añadir `getDailyView`:
   ```typescript
   import { createAppointment, cancelAppointment, getDailyView } from "@/lib/appointments-service";
   ```
2. Añadir el siguiente bloque `describe` al final del archivo (fuera de los describe existentes):
describe("getDailyView", () => {
  beforeEach(resetDatabase);

  it("returns all workers even with no appointments on that date", async () => {
    await testDb.user.create({
      data: { email: "w1@example.com", role: "WORKER", name: "Ana", lastName: "Ruiz" },
    });
    const date = new Date("2026-07-17T00:00:00.000Z");

    const result = await getDailyView(date, testDb);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ana Ruiz");
    expect(result[0].appointments).toHaveLength(0);
  });

  it("returns confirmed appointments with client and service names", async () => {
    const worker = await testDb.user.create({
      data: { email: "w1@example.com", role: "WORKER", name: "Ana", lastName: "Ruiz" },
    });
    const client = await testDb.user.create({
      data: { email: "c1@example.com", role: "CLIENT", name: "Pedro", lastName: "García" },
    });
    const service = await testDb.service.create({
      data: { name: "Corte de pelo", durationMinutes: 60 },
    });
    const date = new Date("2026-07-17T00:00:00.000Z");
    await testDb.appointment.create({
      data: {
        workerId: worker.id,
        clientId: client.id,
        serviceId: service.id,
        date,
        startTime: "10:00",
        endTime: "11:00",
        status: "CONFIRMED",
        createdBy: "CLIENT",
      },
    });

    const result = await getDailyView(date, testDb);

    expect(result).toHaveLength(1);
    expect(result[0].appointments).toHaveLength(1);
    expect(result[0].appointments[0]).toMatchObject({
      startTime: "10:00",
      endTime: "11:00",
      clientName: "Pedro García",
      serviceName: "Corte de pelo",
    });
  });

  it("excludes cancelled appointments", async () => {
    const worker = await testDb.user.create({
      data: { email: "w1@example.com", role: "WORKER", name: "Ana", lastName: "Ruiz" },
    });
    const client = await testDb.user.create({
      data: { email: "c1@example.com", role: "CLIENT", name: "Pedro", lastName: "García" },
    });
    const service = await testDb.service.create({
      data: { name: "Corte de pelo", durationMinutes: 30 },
    });
    const date = new Date("2026-07-17T00:00:00.000Z");
    await testDb.appointment.create({
      data: {
        workerId: worker.id,
        clientId: client.id,
        serviceId: service.id,
        date,
        startTime: "10:00",
        endTime: "10:30",
        status: "CANCELLED",
        createdBy: "CLIENT",
      },
    });

    const result = await getDailyView(date, testDb);

    expect(result[0].appointments).toHaveLength(0);
  });

  it("returns workers sorted alphabetically by name", async () => {
    await testDb.user.create({
      data: { email: "z@example.com", role: "WORKER", name: "Zoe", lastName: "López" },
    });
    await testDb.user.create({
      data: { email: "a@example.com", role: "WORKER", name: "Ana", lastName: "Ruiz" },
    });
    const date = new Date("2026-07-17T00:00:00.000Z");

    const result = await getDailyView(date, testDb);

    expect(result.map((w) => w.name)).toEqual(["Ana Ruiz", "Zoe López"]);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npx vitest run tests/integration/appointments-service.test.ts
```

Resultado esperado: `getDailyView is not a function` o similar — los 4 tests del nuevo `describe` deben fallar.

- [ ] **Step 3: Implementar `getDailyView` en el servicio**

Añadir al final de `src/lib/appointments-service.ts`, antes de cerrar el archivo:

```typescript
export interface DailyViewAppointment {
  id: string;
  startTime: string;
  endTime: string;
  clientName: string;
  serviceName: string;
}

export interface DailyViewWorker {
  id: string;
  name: string;
  appointments: DailyViewAppointment[];
}

export async function getDailyView(
  date: Date,
  db: PrismaClient = defaultPrisma
): Promise<DailyViewWorker[]> {
  const workers = await db.user.findMany({
    where: { role: "WORKER" },
    orderBy: [{ name: "asc" }, { lastName: "asc" }],
  });

  const results: DailyViewWorker[] = [];

  for (const worker of workers) {
    const appointments = await db.appointment.findMany({
      where: { workerId: worker.id, date, status: "CONFIRMED" },
      include: { client: true, service: true },
      orderBy: { startTime: "asc" },
    });

    results.push({
      id: worker.id,
      name: `${worker.name} ${worker.lastName}`,
      appointments: appointments.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        clientName: `${a.client.name} ${a.client.lastName}`,
        serviceName: a.service.name,
      })),
    });
  }

  return results;
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npx vitest run tests/integration/appointments-service.test.ts
```

Resultado esperado: todos los tests en verde, incluyendo los 4 nuevos del `describe("getDailyView")`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appointments-service.ts tests/integration/appointments-service.test.ts
git commit -m "feat: add getDailyView service function with integration tests"
```

---

## Task 2: Endpoint `GET /api/admin/daily-view`

**Files:**
- Create: `src/app/api/admin/daily-view/route.ts`

**Interfaces:**
- Consumes: `getDailyView(date: Date): Promise<DailyViewWorker[]>` de `@/lib/appointments-service`
- Produces: `GET /api/admin/daily-view?date=YYYY-MM-DD` → `DailyViewWorker[]` (JSON)

- [ ] **Step 1: Crear el archivo del endpoint**

Crear `src/app/api/admin/daily-view/route.ts` con el siguiente contenido:

```typescript
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
```

- [ ] **Step 2: Verificar manualmente que el endpoint responde**

Con el servidor arrancado (`npm run dev`), abrir en el navegador (como admin):

```
http://localhost:3000/api/admin/daily-view?date=2026-07-17
```

Resultado esperado: JSON con array de workers. Si no hay workers en la BD, array vacío `[]`.

Sin la cookie de sesión (sin autenticar), debe devolver `{ "error": "No autorizado" }` con status 403.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/daily-view/route.ts
git commit -m "feat: add GET /api/admin/daily-view endpoint for admin role"
```

---

## Task 3: Componente `MonthCalendar`

**Files:**
- Create: `src/app/admin/appointments/MonthCalendar.tsx`

**Interfaces:**
- Produces:
  ```typescript
  // Props de MonthCalendar:
  interface MonthCalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
  }
  export function MonthCalendar(props: MonthCalendarProps): JSX.Element
  ```

- [ ] **Step 1: Crear el componente**

Crear `src/app/admin/appointments/MonthCalendar.tsx`:

```typescript
"use client";

import { useState } from "react";

interface MonthCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toLocalDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function MonthCalendar({ selectedDate, onDateSelect }: MonthCalendarProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth());

  const todayStr = toLocalDateString(new Date());
  const selectedStr = toLocalDateString(selectedDate);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  // Día de la semana del día 1 del mes (0=lunes…6=domingo)
  const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  // getUTCDay: 0=domingo, 1=lunes…6=sábado → convertir a 0=lunes
  const startOffset = (firstDayOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Rellenar hasta múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-64 shrink-0 rounded-lg border border-slate-200 p-4">
      {/* Cabecera de navegación */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {/* Cabecera días de la semana */}
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedStr;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(new Date(`${dateStr}T00:00:00.000Z`))}
              className={[
                "rounded-full py-1 text-sm leading-none transition-colors",
                isSelected
                  ? "bg-slate-900 text-white"
                  : isToday
                  ? "border border-slate-900 text-slate-900 hover:bg-slate-100"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar visualmente**

El componente se verifica al completar la Task 5 (integración en la página). No hay tests unitarios para el calendario — la lógica de offset de días es estándar y se verifica visualmente.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/appointments/MonthCalendar.tsx
git commit -m "feat: add MonthCalendar component for admin daily view"
```

---

## Task 4: Componente `DayGrid`

**Files:**
- Create: `src/app/admin/appointments/DayGrid.tsx`

**Interfaces:**
- Consumes (de Task 1):
  ```typescript
  interface DailyViewAppointment {
    id: string;
    startTime: string;
    endTime: string;
    clientName: string;
    serviceName: string;
  }
  interface DailyViewWorker {
    id: string;
    name: string;
    appointments: DailyViewAppointment[];
  }
  ```
- Produces:
  ```typescript
  interface DayGridProps {
    workers: DailyViewWorker[];
    onCancel: (appointmentId: string) => void;
  }
  export function DayGrid(props: DayGridProps): JSX.Element
  ```

- [ ] **Step 1: Crear el componente**

Crear `src/app/admin/appointments/DayGrid.tsx`:

```typescript
"use client";

import { timeToMinutes } from "@/lib/availability";
import type { DailyViewWorker, DailyViewAppointment } from "@/lib/appointments-service";

interface DayGridProps {
  workers: DailyViewWorker[];
  onCancel: (appointmentId: string) => void;
}

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes < 21 * 60; minutes += 30) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

const SLOTS = generateSlots(); // ["08:00", "08:30", ..., "20:30"]

export function DayGrid({ workers, onCancel }: DayGridProps) {
  if (workers.length === 0) {
    return <p className="text-sm text-slate-500">No hay empleados registrados.</p>;
  }

  // Para cada worker, construir un Map<slotTime, DailyViewAppointment>
  // y un Set<slotTime> de franjas ocupadas por rowSpan de citas anteriores
  type WorkerCell =
    | { kind: "appointment"; appointment: DailyViewAppointment; rowSpan: number }
    | { kind: "covered" }
    | { kind: "empty" };

  const grid: WorkerCell[][] = workers.map((worker) => {
    const byStart = new Map<string, DailyViewAppointment>(
      worker.appointments.map((a) => [a.startTime, a])
    );
    const covered = new Set<string>();
    return SLOTS.map((slot) => {
      if (covered.has(slot)) return { kind: "covered" } as WorkerCell;
      const appt = byStart.get(slot);
      if (appt) {
        const rowSpan = (timeToMinutes(appt.endTime) - timeToMinutes(appt.startTime)) / 30;
        // Marcar franjas intermedias como cubiertas
        for (let i = 1; i < rowSpan; i++) {
          const idx = SLOTS.indexOf(slot) + i;
          if (idx < SLOTS.length) covered.add(SLOTS[idx]);
        }
        return { kind: "appointment", appointment: appt, rowSpan } as WorkerCell;
      }
      return { kind: "empty" } as WorkerCell;
    });
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-16 border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs font-medium text-slate-500">
              Hora
            </th>
            {workers.map((w) => (
              <th
                key={w.id}
                className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
              >
                {w.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot, slotIdx) => (
            <tr key={slot}>
              <td className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-400">
                {slot}
              </td>
              {grid.map((workerCells, workerIdx) => {
                const cell = workerCells[slotIdx];
                if (cell.kind === "covered") return null;
                if (cell.kind === "empty") {
                  return (
                    <td
                      key={workers[workerIdx].id}
                      className="border border-slate-100 px-2"
                      style={{ height: "2rem" }}
                    />
                  );
                }
                // appointment
                return (
                  <td
                    key={workers[workerIdx].id}
                    rowSpan={cell.rowSpan}
                    className="border border-slate-200 bg-blue-50 px-2 py-1 align-top"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900">{cell.appointment.clientName}</span>
                      <span className="text-xs text-slate-600">{cell.appointment.serviceName}</span>
                      <span className="text-xs text-slate-400">
                        {cell.appointment.startTime}–{cell.appointment.endTime}
                      </span>
                      <button
                        onClick={() => onCancel(cell.appointment.id)}
                        className="mt-1 self-start rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/appointments/DayGrid.tsx
git commit -m "feat: add DayGrid component with 30-min slot rows and rowSpan for appointments"
```

---

## Task 5: Página principal — integración y fetch

**Files:**
- Modify: `src/app/admin/appointments/page.tsx`

**Interfaces:**
- Consumes: `MonthCalendar` de `./MonthCalendar`, `DayGrid` de `./DayGrid`
- Consumes tipos: `DailyViewWorker` de `@/lib/appointments-service`

- [ ] **Step 1: Reemplazar la página**

Reemplazar el contenido completo de `src/app/admin/appointments/page.tsx`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import type { DailyViewWorker } from "@/lib/appointments-service";
import { MonthCalendar } from "./MonthCalendar";
import { DayGrid } from "./DayGrid";

function toDateParam(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export default function AdminAppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  });
  const [workers, setWorkers] = useState<DailyViewWorker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDailyView = useCallback(async (date: Date) => {
    setLoading(true);
    const res = await fetch(`/api/admin/daily-view?date=${toDateParam(date)}`);
    if (res.ok) {
      setWorkers(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDailyView(selectedDate);
  }, [selectedDate, fetchDailyView]);

  async function handleCancel(appointmentId: string) {
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    fetchDailyView(selectedDate);
  }

  const dateLabel = selectedDate.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="flex min-h-screen gap-6 px-6 py-8">
      {/* Columna izquierda: calendario */}
      <aside className="shrink-0">
        <MonthCalendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </aside>

      {/* Columna derecha: cuadrícula */}
      <section className="min-w-0 flex-1">
        <h1 className="mb-4 text-xl font-semibold capitalize text-slate-900">{dateLabel}</h1>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <DayGrid workers={workers} onCancel={handleCancel} />
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Con `npm run dev` arrancado:
1. Ir a `/admin/appointments` como ADMIN.
2. Comprobar que el calendario muestra el mes actual con el día de hoy resaltado.
3. Hacer clic en otro día — la cuadrícula debe recargar para ese día.
4. Comprobar que la cuadrícula muestra una fila por cada franja de 30 min (08:00–20:30) y una columna por empleado.
5. Si hay citas confirmadas para ese día, deben aparecer con nombre de cliente, servicio, horario y botón cancelar.
6. Pulsar "Cancelar" en una cita — debe desaparecer de la cuadrícula.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/appointments/page.tsx
git commit -m "feat: rewrite admin appointments page with calendar and daily grid view"
```

---

## Self-Review checklist (para el ejecutor)

Antes de cerrar la tarea, verificar:

- [ ] `npm run build` pasa sin errores de tipos.
- [ ] `npx vitest run tests/integration/appointments-service.test.ts` — todos los tests en verde.
- [ ] El calendario navega a meses anteriores y siguientes correctamente.
- [ ] Seleccionar un día en el calendario cambia la fecha del título y recarga la cuadrícula.
- [ ] Una cita de 60 min ocupa 2 filas en la cuadrícula (rowSpan=2).
- [ ] Las franjas sin cita aparecen como celdas vacías con borde.
- [ ] Cancelar una cita la elimina de la cuadrícula sin recargar la página completa.
