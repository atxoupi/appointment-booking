"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);

  function load() {
    fetch("/api/admin/services")
      .then((res) => res.json())
      .then(setServices);
  }
  useEffect(load, []);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, durationMinutes }),
    });
    setName("");
    load();
  }

  async function toggleActive(service: Service) {
    await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !service.active }),
    });
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Servicios</h1>
      <form onSubmit={addService} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Duración
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Agregar
        </button>
      </form>
      <div className="flex flex-col gap-3">
        {services.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm"
          >
            <span>
              {s.name} ({s.durationMinutes} min) — {s.active ? "activo" : "inactivo"}
            </span>
            <button
              onClick={() => toggleActive(s)}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {s.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
