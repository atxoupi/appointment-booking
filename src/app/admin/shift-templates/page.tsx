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
