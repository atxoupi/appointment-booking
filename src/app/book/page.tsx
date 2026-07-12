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
      prev.map((w) =>
        w.workerId === workerId ? { ...w, slots: w.slots.filter((s) => s !== startTime) } : w
      )
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Reservar cita</h1>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Servicio
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Selecciona un servicio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
      </div>

      {message && (
        <p role="status" className="mb-4 text-sm text-emerald-600">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {availability.map((worker) => (
          <section key={worker.workerId}>
            <h2 className="mb-2 text-lg font-medium text-slate-900">{worker.workerName}</h2>
            <div className="flex flex-wrap gap-2">
              {worker.slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => book(worker.workerId, slot)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {slot}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
