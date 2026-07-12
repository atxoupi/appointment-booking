import { describe, expect, it } from "vitest";
import { getNavLinksForRole } from "@/lib/nav-links";

describe("getNavLinksForRole", () => {
  it("returns login/register links when logged out", () => {
    expect(getNavLinksForRole(undefined)).toEqual([
      { href: "/login", label: "Iniciar sesión" },
      { href: "/register", label: "Registrarse" },
    ]);
  });

  it("returns booking links for CLIENT", () => {
    expect(getNavLinksForRole("CLIENT")).toEqual([
      { href: "/book", label: "Reservar cita" },
      { href: "/my-appointments", label: "Mis citas" },
    ]);
  });

  it("returns the agenda link for WORKER", () => {
    expect(getNavLinksForRole("WORKER")).toEqual([{ href: "/worker", label: "Mi agenda" }]);
  });

  it("returns all admin section links for ADMIN", () => {
    expect(getNavLinksForRole("ADMIN")).toEqual([
      { href: "/admin/services", label: "Servicios" },
      { href: "/admin/shift-templates", label: "Turnos" },
      { href: "/admin/assignments", label: "Asignaciones" },
      { href: "/admin/workers", label: "Trabajadores" },
      { href: "/admin/appointments", label: "Citas" },
      { href: "/admin/site-settings", label: "Ajustes del sitio" },
    ]);
  });
});
