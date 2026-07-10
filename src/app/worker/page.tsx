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
