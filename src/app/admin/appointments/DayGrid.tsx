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
