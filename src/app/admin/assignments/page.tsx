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
