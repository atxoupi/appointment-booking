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
    <main>
      <h1>Servicios</h1>
      <form onSubmit={addService}>
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
        <button type="submit">Agregar</button>
      </form>
      <ul>
        {services.map((s) => (
          <li key={s.id}>
            {s.name} ({s.durationMinutes} min) — {s.active ? "activo" : "inactivo"}
            <button onClick={() => toggleActive(s)}>{s.active ? "Desactivar" : "Activar"}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
