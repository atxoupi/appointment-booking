import type { Role } from "@prisma/client";

export interface NavLink {
  href: string;
  label: string;
}

export function getNavLinksForRole(role: Role | undefined): NavLink[] {
  if (!role) {
    return [
      { href: "/login", label: "Iniciar sesión" },
      { href: "/register", label: "Registrarse" },
    ];
  }
  if (role === "CLIENT") {
    return [
      { href: "/book", label: "Reservar cita" },
      { href: "/my-appointments", label: "Mis citas" },
    ];
  }
  if (role === "WORKER") {
    return [{ href: "/worker", label: "Mi agenda" }];
  }
  return [
    { href: "/admin/services", label: "Servicios" },
    { href: "/admin/shift-templates", label: "Turnos" },
    { href: "/admin/assignments", label: "Asignaciones" },
    { href: "/admin/workers", label: "Trabajadores" },
    { href: "/admin/appointments", label: "Citas" },
    { href: "/admin/site-settings", label: "Ajustes del sitio" },
  ];
}
