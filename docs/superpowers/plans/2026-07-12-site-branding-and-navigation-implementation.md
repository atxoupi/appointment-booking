# Site Branding & Role-Based Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site-wide, role-aware navigation menu, an admin-configurable branding panel (colors, logo, hero photo, business name/tagline), a redesigned landing page, and a Tailwind styling pass across the existing app — per `docs/superpowers/specs/2026-07-12-site-branding-and-navigation-design.md`.

**Architecture:** New `SiteSettings` singleton table (Postgres, via Prisma) holds branding data, including uploaded images as raw `Bytes`. A `site-settings-service.ts` module (get/update) follows the existing `src/lib/*-service.ts` pattern. An admin-only API route handles reads/writes (multipart form data for image uploads via Next's built-in `request.formData()`); two public routes stream the stored image bytes. A server-rendered `layout.tsx` fetches session + settings and passes them as props to a client `Nav` component, whose link set per role comes from a pure, unit-tested function. Tailwind CSS is added for all new and restyled UI.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma/PostgreSQL, NextAuth.js, Vitest, Tailwind CSS v3 (classic `tailwind.config.js` setup — chosen over v4 for stability with this Next 14.2 app and the widest documented compatibility).

## Global Constraints

- Single-tenant: `SiteSettings` is one singleton row, identified by a hardcoded id constant `"singleton"` (no schema-level `@default`, to keep the singleton contract explicit in code rather than implicit in the schema).
- Uploaded images (logo, hero photo) are stored as `Bytes` directly in Postgres — no filesystem writes, no external object storage/dependency.
- Image uploads capped at 2MB, restricted to `image/png`, `image/jpeg`, `image/webp` (no SVG).
- All user-facing text is in Spanish, matching the existing app's copy (e.g. "Iniciar sesión", "Cerrar sesión").
- No new UI testing framework/dependency (no React Testing Library). Service-layer logic and pure functions get automated tests per the existing convention (real test DB for services, no DB for pure functions); UI/styling changes are verified by running the dev server and checking each role's view in a browser, exactly as the rest of this app was built.
- API routes are never tested directly via HTTP in this codebase (confirmed: only service functions and the `authOptions` callback are integration-tested) — this plan follows that same convention rather than introducing route-level tests.
- Tailwind utility class conventions used consistently across every restyled page (defined once here, reused verbatim):
  - Page wrapper: `mx-auto max-w-2xl px-4 py-8` (`max-w-md` for the short auth forms)
  - Heading: `mb-6 text-2xl font-semibold text-slate-900`
  - Form: `flex flex-col gap-4`
  - Label: `flex flex-col gap-1 text-sm font-medium text-slate-700`
  - Text/select input: `rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none`
  - Primary button: `self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700`
  - Secondary/inline button: `rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100`
  - List container: `flex flex-col gap-3`
  - List item card: `flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm`
  - Error text: `text-sm text-red-600`; status/success text: `text-sm text-emerald-600`

---

## File Structure

```
tailwind.config.js
postcss.config.js
prisma/
  schema.prisma                          # + SiteSettings model
src/
  lib/
    site-settings-service.ts             # get/update singleton row
    nav-links.ts                         # pure getNavLinksForRole()
  app/
    components/
      Nav.tsx                            # role-aware nav, client component
    api/
      admin/
        site-settings/route.ts           # GET + PATCH (admin-only)
      site-settings/
        logo/route.ts                    # public image stream
        hero-photo/route.ts              # public image stream
    admin/
      site-settings/page.tsx             # branding form + upload UI
    layout.tsx                           # modified: async, renders Nav
    page.tsx                             # modified: hero landing page
    globals.css                          # modified: Tailwind directives
    login/page.tsx                       # modified: Tailwind styling
    register/page.tsx                    # modified: Tailwind styling
    book/page.tsx                        # modified: Tailwind styling
    my-appointments/page.tsx             # modified: Tailwind styling
    worker/page.tsx                      # modified: Tailwind styling
    admin/services/page.tsx              # modified: Tailwind styling
    admin/shift-templates/page.tsx       # modified: Tailwind styling
    admin/assignments/page.tsx           # modified: Tailwind styling
    admin/workers/page.tsx               # modified: Tailwind styling
    admin/appointments/page.tsx          # modified: Tailwind styling
tests/
  unit/
    nav-links.test.ts
  integration/
    site-settings-service.test.ts
    setup.ts                             # modified: reset siteSettings table
```

---

### Task 1: Install and configure Tailwind CSS

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind utility classes available in every `.tsx` file under `src/app/`; consumed by every later task.

- [ ] **Step 1: Install Tailwind and its PostCSS dependencies**

```bash
npm install -D tailwindcss@^3 postcss@^8 autoprefixer@^10
```

- [ ] **Step 2: Create the Tailwind config**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 3: Create the PostCSS config**

```js
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Replace globals.css with Tailwind directives**

Tailwind's `base` layer already resets margins/box-sizing (replacing the old manual reset), and the hardcoded `prefers-color-scheme: dark` block is dropped since colors become admin-controlled later in this plan (Task 6), not OS-controlled.

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

a {
  color: inherit;
}
```

- [ ] **Step 5: Verify the app still builds**

```bash
npm run build
```

Expected: build succeeds with no errors (existing pages are unchanged visually — nothing references Tailwind classes yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js src/app/globals.css
git commit -m "chore: add and configure Tailwind CSS"
```

---

### Task 2: SiteSettings data model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `tests/integration/setup.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma `SiteSettings` model/type, consumed by `site-settings-service.ts` (Task 3).

- [ ] **Step 1: Add the SiteSettings model**

Append to `prisma/schema.prisma`:

```prisma
model SiteSettings {
  id              String   @id
  businessName    String   @default("Mi Negocio")
  tagline         String   @default("")
  backgroundColor String   @default("#ffffff")
  menuColor       String   @default("#171717")
  logoImage       Bytes?
  logoMimeType    String?
  heroImage       Bytes?
  heroMimeType    String?
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_site_settings
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Apply the same migration to the test database**

```bash
DATABASE_URL="postgresql://app:app@localhost:5433/appointments_test" npx prisma migrate deploy
```

- [ ] **Step 4: Include SiteSettings in the integration test reset helper**

In `tests/integration/setup.ts`, add the new table to `resetDatabase()` (order doesn't matter for this table — no foreign keys):

```typescript
export async function resetDatabase() {
  await testDb.appointment.deleteMany();
  await testDb.workerWeekAssignment.deleteMany();
  await testDb.shiftTemplateRange.deleteMany();
  await testDb.shiftTemplate.deleteMany();
  await testDb.service.deleteMany();
  await testDb.user.deleteMany();
  await testDb.siteSettings.deleteMany();
}
```

- [ ] **Step 5: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/integration/setup.ts
git commit -m "feat: add SiteSettings data model"
```

---

### Task 3: Site settings service

**Files:**
- Create: `src/lib/site-settings-service.ts`
- Test: `tests/integration/site-settings-service.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2 model)
- Produces: `SiteSettingsData` type, `getSiteSettings(db?): Promise<SiteSettingsData>`, `updateSiteSettings(input: Partial<SiteSettingsData>, db?): Promise<SiteSettingsData>` — consumed by the API routes (Task 4), `layout.tsx` and `page.tsx` (Tasks 6, 8).

- [ ] **Step 1: Write the failing integration tests**

```typescript
// tests/integration/site-settings-service.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDatabase } from "./setup";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings-service";

describe("site-settings-service", () => {
  beforeEach(resetDatabase);
  afterAll(() => testDb.$disconnect());

  it("returns defaults when no settings row exists yet", async () => {
    const settings = await getSiteSettings(testDb);

    expect(settings.businessName).toBe("Mi Negocio");
    expect(settings.backgroundColor).toBe("#ffffff");
    expect(settings.menuColor).toBe("#171717");
    expect(settings.logoImage).toBeNull();
    expect(settings.heroImage).toBeNull();
  });

  it("creates the singleton row on first update", async () => {
    const updated = await updateSiteSettings(
      { businessName: "Peluquería Pelos", menuColor: "#222222" },
      testDb
    );

    expect(updated.businessName).toBe("Peluquería Pelos");
    expect(updated.menuColor).toBe("#222222");

    const fetched = await getSiteSettings(testDb);
    expect(fetched.businessName).toBe("Peluquería Pelos");
  });

  it("stores and returns uploaded image bytes and mime type", async () => {
    const fakeImage = Buffer.from([137, 80, 78, 71]);

    const updated = await updateSiteSettings(
      { logoImage: fakeImage, logoMimeType: "image/png" },
      testDb
    );

    expect(updated.logoImage).toEqual(fakeImage);
    expect(updated.logoMimeType).toBe("image/png");
  });

  it("updates only the fields provided, leaving others unchanged", async () => {
    await updateSiteSettings(
      { businessName: "Peluquería Pelos", tagline: "Cortes desde 1990" },
      testDb
    );

    const updated = await updateSiteSettings({ tagline: "Nueva frase" }, testDb);

    expect(updated.businessName).toBe("Peluquería Pelos");
    expect(updated.tagline).toBe("Nueva frase");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/integration/site-settings-service.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/site-settings-service'`.

- [ ] **Step 3: Implement the service**

```typescript
// src/lib/site-settings-service.ts
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export interface SiteSettingsData {
  businessName: string;
  tagline: string;
  backgroundColor: string;
  menuColor: string;
  logoImage: Buffer | null;
  logoMimeType: string | null;
  heroImage: Buffer | null;
  heroMimeType: string | null;
}

const DEFAULTS: SiteSettingsData = {
  businessName: "Mi Negocio",
  tagline: "",
  backgroundColor: "#ffffff",
  menuColor: "#171717",
  logoImage: null,
  logoMimeType: null,
  heroImage: null,
  heroMimeType: null,
};

export async function getSiteSettings(
  db: PrismaClient = defaultPrisma
): Promise<SiteSettingsData> {
  const row = await db.siteSettings.findUnique({ where: { id: SINGLETON_ID } });
  return row ?? DEFAULTS;
}

export async function updateSiteSettings(
  input: Partial<SiteSettingsData>,
  db: PrismaClient = defaultPrisma
): Promise<SiteSettingsData> {
  return db.siteSettings.upsert({
    where: { id: SINGLETON_ID },
    update: input,
    create: { id: SINGLETON_ID, ...DEFAULTS, ...input },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/integration/site-settings-service.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-settings-service.ts tests/integration/site-settings-service.test.ts
git commit -m "feat: add site settings service"
```

---

### Task 4: Site settings API routes

**Files:**
- Create: `src/app/api/admin/site-settings/route.ts`
- Create: `src/app/api/site-settings/logo/route.ts`
- Create: `src/app/api/site-settings/hero-photo/route.ts`

**Interfaces:**
- Consumes: `getSiteSettings`, `updateSiteSettings`, `SiteSettingsData` (Task 3), `authOptions` (existing, `src/lib/auth.ts`)
- Produces: `GET/PATCH /api/admin/site-settings` (admin-only, JSON shape `{ businessName, tagline, backgroundColor, menuColor, hasLogo, hasHeroPhoto }`); `GET /api/site-settings/logo` and `GET /api/site-settings/hero-photo` (public, stream image bytes) — consumed by the admin settings page (Task 7), `Nav` (Task 6), and the landing page (Task 8).

- [ ] **Step 1: Write the admin settings route (GET + PATCH)**

```typescript
// src/app/api/admin/site-settings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings, type SiteSettingsData } from "@/lib/site-settings-service";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

function toResponseShape(settings: SiteSettingsData) {
  return {
    businessName: settings.businessName,
    tagline: settings.tagline,
    backgroundColor: settings.backgroundColor,
    menuColor: settings.menuColor,
    hasLogo: settings.logoImage !== null,
    hasHeroPhoto: settings.heroImage !== null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const settings = await getSiteSettings();
  return NextResponse.json(toResponseShape(settings));
}

async function readImageField(formData: FormData, field: string) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("IMAGE_TYPE_NOT_ALLOWED");
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type };
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData = await request.formData();

  let logo, heroPhoto;
  try {
    logo = await readImageField(formData, "logo");
    heroPhoto = await readImageField(formData, "heroPhoto");
  } catch (err) {
    const message =
      err instanceof Error && err.message === "IMAGE_TOO_LARGE"
        ? "La imagen supera el tamaño máximo de 2MB"
        : "Formato de imagen no permitido (usa PNG, JPEG o WEBP)";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const businessName = formData.get("businessName");
  const tagline = formData.get("tagline");
  const backgroundColor = formData.get("backgroundColor");
  const menuColor = formData.get("menuColor");

  const updated = await updateSiteSettings({
    ...(typeof businessName === "string" ? { businessName } : {}),
    ...(typeof tagline === "string" ? { tagline } : {}),
    ...(typeof backgroundColor === "string" ? { backgroundColor } : {}),
    ...(typeof menuColor === "string" ? { menuColor } : {}),
    ...(logo ? { logoImage: logo.buffer, logoMimeType: logo.mimeType } : {}),
    ...(heroPhoto ? { heroImage: heroPhoto.buffer, heroMimeType: heroPhoto.mimeType } : {}),
  });

  return NextResponse.json(toResponseShape(updated));
}
```

- [ ] **Step 2: Write the public logo route**

```typescript
// src/app/api/site-settings/logo/route.ts
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings-service";

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings.logoImage || !settings.logoMimeType) {
    return NextResponse.json({ error: "No hay logo configurado" }, { status: 404 });
  }
  return new NextResponse(settings.logoImage, {
    headers: {
      "Content-Type": settings.logoMimeType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
```

- [ ] **Step 3: Write the public hero-photo route**

```typescript
// src/app/api/site-settings/hero-photo/route.ts
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings-service";

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings.heroImage || !settings.heroMimeType) {
    return NextResponse.json({ error: "No hay foto de portada configurada" }, { status: 404 });
  }
  return new NextResponse(settings.heroImage, {
    headers: {
      "Content-Type": settings.heroMimeType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
```

- [ ] **Step 4: Verify types compile**

```bash
npm run build
```

Expected: build succeeds. Per this codebase's existing convention, these routes have no direct HTTP-level test — end-to-end behavior is verified in the browser once the admin UI (Task 7) exists to exercise them.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/site-settings/route.ts src/app/api/site-settings
git commit -m "feat: add site settings API routes"
```

---

### Task 5: Role-based nav link logic

**Files:**
- Create: `src/lib/nav-links.ts`
- Test: `tests/unit/nav-links.test.ts`

**Interfaces:**
- Consumes: Prisma `Role` enum (existing)
- Produces: `NavLink` type, `getNavLinksForRole(role: Role | undefined): NavLink[]` — consumed by `Nav` (Task 6).

- [ ] **Step 1: Write the failing unit tests**

```typescript
// tests/unit/nav-links.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/nav-links.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/nav-links'`.

- [ ] **Step 3: Implement the pure function**

```typescript
// src/lib/nav-links.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/nav-links.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav-links.ts tests/unit/nav-links.test.ts
git commit -m "feat: add pure role-based nav link function"
```

---

### Task 6: Nav component and root layout

**Files:**
- Create: `src/app/components/Nav.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `getNavLinksForRole` (Task 5), `getSiteSettings` (Task 3), `authOptions` (existing)
- Produces: site-wide `<Nav>` rendered above every page; consumed visually by all later page tasks (no code import needed elsewhere).

- [ ] **Step 1: Write the Nav component**

```tsx
// src/app/components/Nav.tsx
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
```

- [ ] **Step 2: Wire the Nav into the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "./components/Nav";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings-service";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Reserva de citas",
  description: "Sistema de reserva de citas",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const settings = await getSiteSettings();

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}
        style={{ backgroundColor: settings.backgroundColor }}
      >
        <Providers>
          <Nav
            role={session?.user.role}
            settings={{
              businessName: settings.businessName,
              menuColor: settings.menuColor,
              hasLogo: settings.logoImage !== null,
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify in the browser**

```bash
npm run db:up
npm run dev
```

Visit `http://localhost:3000`. Expected: a nav bar appears at the top showing "Mi Negocio" and "Iniciar sesión" / "Registrarse" links (default settings, no row saved yet). Log in as the seeded admin and confirm the nav switches to the 6 admin links plus "Cerrar sesión", and that it works.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/Nav.tsx src/app/layout.tsx
git commit -m "feat: add role-based site navigation"
```

---

### Task 7: Admin site settings page

**Files:**
- Create: `src/app/admin/site-settings/page.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/admin/site-settings` (Task 4)
- Produces: `/admin/site-settings` page, linked from the admin nav (Task 6, already points here).

- [ ] **Step 1: Write the admin settings page**

```tsx
// src/app/admin/site-settings/page.tsx
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
```

- [ ] **Step 2: Verify end-to-end in the browser**

```bash
npm run dev
```

Log in as the seeded admin, go to `/admin/site-settings`. Change the business name and both colors, upload a small PNG as logo and another as hero photo, click "Guardar". Expected: "Ajustes guardados" message, the nav bar's background/logo/name update on next navigation, page reload shows the same values persisted (confirms the PATCH route, GET route, and image-streaming routes from Task 4 all work).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/site-settings/page.tsx
git commit -m "feat: add admin site settings page"
```

---

### Task 8: Landing page redesign

**Files:**
- Modify: `src/app/page.tsx`
- Delete: `src/app/page.module.css`

**Interfaces:**
- Consumes: `getSiteSettings` (Task 3), `authOptions` (existing)
- Produces: the public `/` landing page.

- [ ] **Step 1: Replace the landing page**

```tsx
// src/app/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings-service";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const settings = await getSiteSettings();

  const cta =
    session?.user.role === "CLIENT"
      ? { href: "/book", label: "Reservar cita" }
      : { href: "/login", label: "Iniciar sesión" };

  return (
    <main
      className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-slate-100 bg-cover bg-center px-4 text-center"
      style={settings.heroImage ? { backgroundImage: "url(/api/site-settings/hero-photo)" } : undefined}
    >
      <div className="rounded-lg bg-white/85 px-8 py-10 backdrop-blur-sm">
        <h1 className="text-3xl font-semibold text-slate-900">{settings.businessName}</h1>
        {settings.tagline && <p className="mt-2 text-lg text-slate-700">{settings.tagline}</p>}
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          {cta.label}
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the now-unused CSS module**

```bash
rm src/app/page.module.css
```

- [ ] **Step 3: Verify in the browser**

```bash
npm run dev
```

Visit `/` logged out: expect the business name/tagline and an "Iniciar sesión" button. Log in as a CLIENT and revisit `/`: expect the button to read "Reservar cita" and link to `/book`. If a hero photo was uploaded in Task 7, confirm it renders as the background.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git rm src/app/page.module.css
git commit -m "feat: redesign landing page with site branding"
```

---

### Task 9: Style auth pages

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: nothing new (styling only, no logic changes)
- Produces: nothing consumed by later tasks (leaf UI change)

- [ ] **Step 1: Restyle the login page**

```tsx
// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Entrar
        </button>
      </form>
      <button
        onClick={() => signIn("google")}
        className="mt-3 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Continuar con Google
      </button>
      <p className="mt-6 text-sm text-slate-600">
        ¿No tienes cuenta?{" "}
        <a href="/register" className="font-medium text-slate-900 underline">
          Regístrate
        </a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Restyle the register page**

```tsx
// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo registrar");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Apellidos
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Teléfono
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Contraseña
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Registrarme
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify in the browser**

```bash
npm run dev
```

Visit `/login` and `/register`. Expected: both forms render with consistent spacing/styling, and the existing behavior (submit, error messages, Google button, redirect) works exactly as before — no logic changed.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/register/page.tsx
git commit -m "style: apply Tailwind styling to auth pages"
```

---

### Task 10: Style client and worker pages

**Files:**
- Modify: `src/app/book/page.tsx`
- Modify: `src/app/my-appointments/page.tsx`
- Modify: `src/app/worker/page.tsx`

**Interfaces:**
- Consumes: nothing new (styling only, no logic changes)
- Produces: nothing consumed by later tasks (leaf UI change)

- [ ] **Step 1: Restyle the booking page**

```tsx
// src/app/book/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}
interface WorkerAvailability {
  workerId: string;
  workerName: string;
  slots: string[];
}

export default function BookPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [availability, setAvailability] = useState<WorkerAvailability[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/services")
      .then((res) => res.json())
      .then(setServices);
  }, []);

  useEffect(() => {
    if (!serviceId || !date) {
      setAvailability([]);
      return;
    }
    fetch(`/api/availability?serviceId=${serviceId}&date=${date}`)
      .then((res) => res.json())
      .then(setAvailability);
  }, [serviceId, date]);

  async function book(workerId: string, startTime: string) {
    setMessage(null);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, serviceId, date, startTime }),
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "No se pudo reservar");
      return;
    }
    setMessage("¡Cita reservada!");
    setAvailability((prev) =>
      prev.map((w) =>
        w.workerId === workerId ? { ...w, slots: w.slots.filter((s) => s !== startTime) } : w
      )
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Reservar cita</h1>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Servicio
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Selecciona un servicio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
      </div>

      {message && (
        <p role="status" className="mb-4 text-sm text-emerald-600">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {availability.map((worker) => (
          <section key={worker.workerId}>
            <h2 className="mb-2 text-lg font-medium text-slate-900">{worker.workerName}</h2>
            <div className="flex flex-wrap gap-2">
              {worker.slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => book(worker.workerId, slot)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {slot}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Restyle "my appointments"**

```tsx
// src/app/my-appointments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  serviceId: string;
  workerId: string;
}

export default function MyAppointmentsPage() {
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Mis citas</h1>
      <div className="flex flex-col gap-3">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm"
          >
            <span>
              {a.date.slice(0, 10)} {a.startTime}-{a.endTime} — {a.status}
            </span>
            {a.status === "CONFIRMED" && (
              <button
                onClick={() => cancel(a.id)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Restyle the worker agenda**

```tsx
// src/app/worker/page.tsx
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
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev
```

Log in as a CLIENT, visit `/book`, pick a service/date, confirm slots render as buttons and booking still works. Visit `/my-appointments` and confirm cancel still works. Log in as a WORKER, visit `/worker`, confirm the agenda list and cancel button still work.

- [ ] **Step 5: Commit**

```bash
git add src/app/book/page.tsx src/app/my-appointments/page.tsx src/app/worker/page.tsx
git commit -m "style: apply Tailwind styling to client and worker pages"
```

---

### Task 11: Style admin CRUD pages

**Files:**
- Modify: `src/app/admin/services/page.tsx`
- Modify: `src/app/admin/shift-templates/page.tsx`
- Modify: `src/app/admin/assignments/page.tsx`
- Modify: `src/app/admin/workers/page.tsx`
- Modify: `src/app/admin/appointments/page.tsx`

**Interfaces:**
- Consumes: nothing new (styling only, no logic changes)
- Produces: nothing consumed by later tasks (leaf UI change)

- [ ] **Step 1: Restyle the services page**

```tsx
// src/app/admin/services/page.tsx
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
```

- [ ] **Step 2: Restyle the shift templates page**

```tsx
// src/app/admin/shift-templates/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Range {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
interface ShiftTemplate {
  id: string;
  name: string;
  isVacation: boolean;
  ranges: Range[];
}

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function AdminShiftTemplatesPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [name, setName] = useState("");
  const [isVacation, setIsVacation] = useState(false);
  const [ranges, setRanges] = useState<Range[]>([]);

  function load() {
    fetch("/api/admin/shift-templates")
      .then((res) => res.json())
      .then(setTemplates);
  }
  useEffect(load, []);

  function addRangeRow() {
    setRanges([...ranges, { dayOfWeek: 0, startTime: "08:00", endTime: "16:00" }]);
  }

  function updateRange(index: number, patch: Partial<Range>) {
    setRanges(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/shift-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isVacation, ranges: isVacation ? [] : ranges }),
    });
    setName("");
    setRanges([]);
    setIsVacation(false);
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Turnos</h1>
      <form onSubmit={createTemplate} className="mb-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre del turno
          <input
            placeholder="Nombre del turno"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isVacation} onChange={(e) => setIsVacation(e.target.checked)} />
          Es vacaciones (sin disponibilidad)
        </label>

        {!isVacation && (
          <>
            <button
              type="button"
              onClick={addRangeRow}
              className="self-start rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Agregar franja
            </button>
            {ranges.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select
                  value={r.dayOfWeek}
                  onChange={(e) => updateRange(i, { dayOfWeek: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  {DAY_LABELS.map((label, day) => (
                    <option key={day} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={r.startTime}
                  onChange={(e) => updateRange(i, { startTime: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                <input
                  type="time"
                  value={r.endTime}
                  onChange={(e) => updateRange(i, { endTime: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            ))}
          </>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Crear turno
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">
              {t.name} {t.isVacation && "(vacaciones)"}
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-slate-600">
              {t.ranges.map((r, i) => (
                <li key={i}>
                  {DAY_LABELS[r.dayOfWeek]}: {r.startTime}-{r.endTime}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Restyle the assignments page**

```tsx
// src/app/admin/assignments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Worker {
  id: string;
  name: string;
  lastName: string;
}
interface ShiftTemplate {
  id: string;
  name: string;
}

export default function AdminAssignmentsPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [shiftTemplateId, setShiftTemplateId] = useState("");
  const [firstWeek, setFirstWeek] = useState("");
  const [weekCount, setWeekCount] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/workers")
      .then((res) => res.json())
      .then(setWorkers);
    fetch("/api/admin/shift-templates")
      .then((res) => res.json())
      .then(setTemplates);
  }, []);

  function weekStartDates(): string[] {
    const dates: string[] = [];
    const start = new Date(`${firstWeek}T00:00:00.000Z`);
    for (let i = 0; i < weekCount; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i * 7);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/worker-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, shiftTemplateId, weekStartDates: weekStartDates() }),
    });
    setMessage(res.ok ? "Turnos asignados" : "Error al asignar");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Asignar turnos semanales</h1>
      <form onSubmit={assign} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Trabajador
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Selecciona</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Turno
          <select
            value={shiftTemplateId}
            onChange={(e) => setShiftTemplateId(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">Selecciona</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Primer lunes
          <input
            type="date"
            value={firstWeek}
            onChange={(e) => setFirstWeek(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Cantidad de semanas
          <input
            type="number"
            min={1}
            value={weekCount}
            onChange={(e) => setWeekCount(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Asignar
        </button>
      </form>
      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-600">
          {message}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Restyle the workers page**

```tsx
// src/app/admin/workers/page.tsx
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
```

- [ ] **Step 5: Restyle the admin appointments page**

```tsx
// src/app/admin/appointments/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  clientId: string;
  workerId: string;
  serviceId: string;
}

export default function AdminAppointmentsPage() {
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Todas las citas</h1>
      <div className="flex flex-col gap-3">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm"
          >
            <span>
              {a.date.slice(0, 10)} {a.startTime}-{a.endTime} — {a.status}
            </span>
            {a.status === "CONFIRMED" && (
              <button
                onClick={() => cancel(a.id)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify in the browser**

```bash
npm run dev
```

Log in as the seeded admin and click through all 6 admin pages (services, shift-templates, assignments, workers, appointments, site-settings). Confirm every existing action still works (create service, toggle active, create shift template with ranges, assign weeks, create worker, cancel appointment) and that styling is visually consistent across pages.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests (existing + new from Tasks 3 and 5) PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/services/page.tsx src/app/admin/shift-templates/page.tsx src/app/admin/assignments/page.tsx src/app/admin/workers/page.tsx src/app/admin/appointments/page.tsx
git commit -m "style: apply Tailwind styling to admin CRUD pages"
```

---

## Final Verification

After all 11 tasks:

```bash
npm run db:up
npm run build
npm test
npm run dev
```

Manual walkthrough:
1. Visit `/` logged out — see business name/default styling and "Iniciar sesión" CTA.
2. Log in as admin (seeded via `npx prisma db seed`), go to `/admin/site-settings`, set a business name, tagline, background color, menu color, upload a logo and hero photo, save.
3. Revisit `/` — hero photo, name, and tagline appear; nav shows the new menu color and logo.
4. Confirm nav link sets differ correctly across a logged-out visitor, a CLIENT, a WORKER, and the ADMIN.
5. Click through every admin page and confirm existing CRUD flows (services, shift templates, assignments, workers, appointments) still function.
6. Book an appointment as a CLIENT via `/book`, cancel it via `/my-appointments`, and confirm a WORKER sees it in `/worker`.
