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
    try {
      const res = await fetch(`/api/admin/daily-view?date=${toDateParam(date)}`);
      if (res.ok) {
        setWorkers(await res.json());
      }
    } finally {
      setLoading(false);
    }
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
