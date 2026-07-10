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
    <main>
      <h1>Trabajadores</h1>
      <form onSubmit={createWorker}>
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Apellidos"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          placeholder="Contraseña inicial"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear trabajador</button>
      </form>
      <ul>
        {workers.map((w) => (
          <li key={w.id}>
            {w.name} {w.lastName} — {w.email}
          </li>
        ))}
      </ul>
    </main>
  );
}
