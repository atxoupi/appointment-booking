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
