"use client";

import { useEffect, useState } from "react";

interface Worker {
  id: string;
  name: string;
  lastName: string;
  email: string;
}

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/workers")
      .then((res) => res.json())
      .then(setWorkers);
  }
  useEffect(load, []);

  async function createWorker(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear");
      return;
    }
    setForm({ name: "", lastName: "", email: "", phone: "", password: "" });
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Trabajadores</h1>
      <form onSubmit={createWorker} className="mb-8 flex flex-col gap-4">
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          placeholder="Apellidos"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Contraseña inicial"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Crear trabajador
        </button>
      </form>
      <div className="flex flex-col gap-3">
        {workers.map((w) => (
          <div key={w.id} className="rounded-md border border-slate-200 p-3 text-sm">
            {w.name} {w.lastName} — {w.email}
          </div>
        ))}
      </div>
    </main>
  );
}
