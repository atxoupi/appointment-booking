"use client";

import { useEffect, useState } from "react";

interface SiteSettingsResponse {
  businessName: string;
  tagline: string;
  backgroundColor: string;
  menuColor: string;
  hasLogo: boolean;
  hasHeroPhoto: boolean;
}

export default function AdminSiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettingsResponse | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [menuColor, setMenuColor] = useState("#171717");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/site-settings")
      .then((res) => res.json())
      .then((data: SiteSettingsResponse) => {
        setSettings(data);
        setBusinessName(data.businessName);
        setTagline(data.tagline);
        setBackgroundColor(data.backgroundColor);
        setMenuColor(data.menuColor);
      });
  }
  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("businessName", businessName);
    formData.set("tagline", tagline);
    formData.set("backgroundColor", backgroundColor);
    formData.set("menuColor", menuColor);
    if (logoFile) formData.set("logo", logoFile);
    if (heroFile) formData.set("heroPhoto", heroFile);

    const res = await fetch("/api/admin/site-settings", { method: "PATCH", body: formData });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "No se pudo guardar");
      return;
    }
    setMessage("Ajustes guardados");
    setLogoFile(null);
    setHeroFile(null);
    load();
  }

  if (!settings) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Ajustes del sitio</h1>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre del negocio
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Frase (tagline)
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          Color de fondo
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          Color del menú
          <input type="color" value={menuColor} onChange={(e) => setMenuColor(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Logo
          {settings.hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/site-settings/logo" alt="Logo actual" className="h-12 w-12 object-contain" />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Foto de portada
          {settings.hasHeroPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/site-settings/hero-photo"
              alt="Foto actual"
              className="h-32 w-full rounded-md object-cover"
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setHeroFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {message && (
          <p role="status" className="text-sm text-emerald-600">
            {message}
          </p>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Guardar
        </button>
      </form>
    </main>
  );
}
