"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { getNavLinksForRole } from "@/lib/nav-links";

export interface NavSettings {
  businessName: string;
  menuColor: string;
  hasLogo: boolean;
}

export function Nav({ role, settings }: { role: Role | undefined; settings: NavSettings }) {
  const links = getNavLinksForRole(role);

  return (
    <nav
      style={{ backgroundColor: settings.menuColor }}
      className="flex items-center justify-between px-6 py-3 text-white"
    >
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        {settings.hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/site-settings/logo"
            alt={settings.businessName}
            className="h-8 w-8 object-contain"
          />
        )}
        <span>{settings.businessName}</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
        {role && (
          <button onClick={() => signOut({ callbackUrl: "/" })} className="hover:underline">
            Cerrar sesión
          </button>
        )}
      </div>
    </nav>
  );
}
