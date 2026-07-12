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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Mi agenda</h1>
      <div className="flex flex-col gap-3">
        {upcoming.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm"
          >
            <span>
              {a.date.slice(0, 10)} {a.startTime}-{a.endTime}
            </span>
            <button
              onClick={() => cancel(a.id)}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
