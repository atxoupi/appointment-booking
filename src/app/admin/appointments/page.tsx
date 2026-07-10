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
