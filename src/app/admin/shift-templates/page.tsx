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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Turnos</h1>
      <form onSubmit={createTemplate} className="mb-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre del turno
          <input
            placeholder="Nombre del turno"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isVacation} onChange={(e) => setIsVacation(e.target.checked)} />
          Es vacaciones (sin disponibilidad)
        </label>

        {!isVacation && (
          <>
            <button
              type="button"
              onClick={addRangeRow}
              className="self-start rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Agregar franja
            </button>
            {ranges.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select
                  value={r.dayOfWeek}
                  onChange={(e) => updateRange(i, { dayOfWeek: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
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
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                <input
                  type="time"
                  value={r.endTime}
                  onChange={(e) => updateRange(i, { endTime: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            ))}
          </>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Crear turno
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">
              {t.name} {t.isVacation && "(vacaciones)"}
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-slate-600">
              {t.ranges.map((r, i) => (
                <li key={i}>
                  {DAY_LABELS[r.dayOfWeek]}: {r.startTime}-{r.endTime}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
