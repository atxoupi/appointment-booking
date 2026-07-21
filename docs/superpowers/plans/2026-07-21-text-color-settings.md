# Text Color Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four text-color fields to `SiteSettings` so admins can customize the nav text, page text, and CTA button colors from the admin panel.

**Architecture:** New fields flow from the Prisma schema → service layer → API route → layout/page components and the admin UI. No new files are needed; every change is an additive extension of existing patterns.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 6, PostgreSQL, Vitest (integration tests against real test DB), Tailwind CSS.

## Global Constraints

- No new npm dependencies.
- Color values stored as hex strings (e.g. `#ffffff`).
- Migrations applied via `npx prisma migrate dev`; test DB updated with `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy`.
- Integration tests run against `TEST_DATABASE_URL` (port 5433). Both Docker DBs must be running (`npm run db:up`) before running tests.
- All tests via `npm test`; single file via `npx vitest run <path>`.
- Never commit unless explicitly asked.

---

### Task 1: Schema, service, and integration tests

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/site-settings-service.ts`
- Modify: `tests/integration/site-settings-service.test.ts`

**Interfaces:**
- Produces: `SiteSettingsData` extended with `menuTextColor: string`, `textColor: string`, `ctaBackgroundColor: string`, `ctaTextColor: string`.
- `getSiteSettings()` and `updateSiteSettings()` signatures unchanged; they just handle more fields.

---

- [ ] **Step 1: Add four fields to `prisma/schema.prisma`**

In the `SiteSettings` model, add after `menuColor`:

```prisma
menuTextColor       String   @default("#ffffff")
textColor           String   @default("#0f172a")
ctaBackgroundColor  String   @default("#0f172a")
ctaTextColor        String   @default("#ffffff")
```

Full model after edit:

```prisma
model SiteSettings {
  id                 String   @id
  businessName       String   @default("Mi Negocio")
  tagline            String   @default("")
  backgroundColor    String   @default("#ffffff")
  menuColor          String   @default("#171717")
  menuTextColor      String   @default("#ffffff")
  textColor          String   @default("#0f172a")
  ctaBackgroundColor String   @default("#0f172a")
  ctaTextColor       String   @default("#ffffff")
  logoImage          Bytes?
  logoMimeType       String?
  heroImage          Bytes?
  heroMimeType       String?
  updatedAt          DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration on dev DB**

```bash
npx prisma migrate dev --name add_text_colors
```

Expected: Prisma creates `prisma/migrations/YYYYMMDDHHMMSS_add_text_colors/migration.sql` and applies it. No errors.

- [ ] **Step 3: Apply migration to test DB**

```bash
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 4: Update `src/lib/site-settings-service.ts`**

Replace the `SiteSettingsData` interface and `DEFAULTS` constant:

```ts
export interface SiteSettingsData {
  businessName: string;
  tagline: string;
  backgroundColor: string;
  menuColor: string;
  menuTextColor: string;
  textColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
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
  menuTextColor: "#ffffff",
  textColor: "#0f172a",
  ctaBackgroundColor: "#0f172a",
  ctaTextColor: "#ffffff",
  logoImage: null,
  logoMimeType: null,
  heroImage: null,
  heroMimeType: null,
};
```

No changes needed to `getSiteSettings` or `updateSiteSettings`; Prisma now returns the new columns automatically.

- [ ] **Step 5: Update the "returns defaults" test to assert on the new fields**

In `tests/integration/site-settings-service.test.ts`, update the first test:

```ts
it("returns defaults when no settings row exists yet", async () => {
  const settings = await getSiteSettings(testDb);

  expect(settings.businessName).toBe("Mi Negocio");
  expect(settings.backgroundColor).toBe("#ffffff");
  expect(settings.menuColor).toBe("#171717");
  expect(settings.menuTextColor).toBe("#ffffff");
  expect(settings.textColor).toBe("#0f172a");
  expect(settings.ctaBackgroundColor).toBe("#0f172a");
  expect(settings.ctaTextColor).toBe("#ffffff");
  expect(settings.logoImage).toBeNull();
  expect(settings.heroImage).toBeNull();
});
```

- [ ] **Step 6: Add a new test for updating text color fields**

Append to the `describe` block in the same file:

```ts
it("persists text color fields and returns them on subsequent reads", async () => {
  await updateSiteSettings(
    {
      menuTextColor: "#000000",
      textColor: "#334155",
      ctaBackgroundColor: "#2563eb",
      ctaTextColor: "#ffffff",
    },
    testDb
  );

  const fetched = await getSiteSettings(testDb);
  expect(fetched.menuTextColor).toBe("#000000");
  expect(fetched.textColor).toBe("#334155");
  expect(fetched.ctaBackgroundColor).toBe("#2563eb");
  expect(fetched.ctaTextColor).toBe("#ffffff");
});
```

- [ ] **Step 7: Run the site-settings integration tests**

```bash
npx vitest run tests/integration/site-settings-service.test.ts
```

Expected: All 6 tests pass (5 original + 1 new).

---

### Task 2: API route

**Files:**
- Modify: `src/app/api/admin/site-settings/route.ts`

**Interfaces:**
- Consumes: `SiteSettingsData` with the 4 new fields (from Task 1).
- Produces: GET and PATCH responses now include `menuTextColor`, `textColor`, `ctaBackgroundColor`, `ctaTextColor`.

---

- [ ] **Step 1: Extend `toResponseShape` to include the new fields**

Replace the existing `toResponseShape` function:

```ts
function toResponseShape(settings: SiteSettingsData) {
  return {
    businessName: settings.businessName,
    tagline: settings.tagline,
    backgroundColor: settings.backgroundColor,
    menuColor: settings.menuColor,
    menuTextColor: settings.menuTextColor,
    textColor: settings.textColor,
    ctaBackgroundColor: settings.ctaBackgroundColor,
    ctaTextColor: settings.ctaTextColor,
    hasLogo: settings.logoImage !== null,
    hasHeroPhoto: settings.heroImage !== null,
  };
}
```

- [ ] **Step 2: Read the four new fields in the PATCH handler**

After the existing `const menuColor = formData.get("menuColor");` line, add:

```ts
const menuTextColor = formData.get("menuTextColor");
const textColor = formData.get("textColor");
const ctaBackgroundColor = formData.get("ctaBackgroundColor");
const ctaTextColor = formData.get("ctaTextColor");
```

Then extend the `updateSiteSettings` call to include them:

```ts
const updated = await updateSiteSettings({
  ...(typeof businessName === "string" ? { businessName } : {}),
  ...(typeof tagline === "string" ? { tagline } : {}),
  ...(typeof backgroundColor === "string" ? { backgroundColor } : {}),
  ...(typeof menuColor === "string" ? { menuColor } : {}),
  ...(typeof menuTextColor === "string" ? { menuTextColor } : {}),
  ...(typeof textColor === "string" ? { textColor } : {}),
  ...(typeof ctaBackgroundColor === "string" ? { ctaBackgroundColor } : {}),
  ...(typeof ctaTextColor === "string" ? { ctaTextColor } : {}),
  ...(logo ? { logoImage: logo.buffer, logoMimeType: logo.mimeType } : {}),
  ...(heroPhoto ? { heroImage: heroPhoto.buffer, heroMimeType: heroPhoto.mimeType } : {}),
});
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npm run build 2>&1 | head -30
```

Expected: No type errors related to `SiteSettingsData` or the route.

---

### Task 3: Apply colors in Nav, layout, and home page

**Files:**
- Modify: `src/app/components/Nav.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `SiteSettingsData` from `getSiteSettings()` (Task 1).
- `NavSettings` interface gains `menuTextColor: string`.

---

- [ ] **Step 1: Add `menuTextColor` to `NavSettings` and apply it in `Nav.tsx`**

Replace the file content:

```tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { getNavLinksForRole } from "@/lib/nav-links";

export interface NavSettings {
  businessName: string;
  menuColor: string;
  menuTextColor: string;
  hasLogo: boolean;
}

export function Nav({ role, settings }: { role: Role | undefined; settings: NavSettings }) {
  const links = getNavLinksForRole(role);

  return (
    <nav
      style={{ backgroundColor: settings.menuColor, color: settings.menuTextColor }}
      className="flex items-center justify-between px-6 py-3"
    >
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold" style={{ color: settings.menuTextColor }}>
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
          <Link key={link.href} href={link.href} className="hover:underline" style={{ color: settings.menuTextColor }}>
            {link.label}
          </Link>
        ))}
        {role && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="hover:underline"
            style={{ color: settings.menuTextColor }}
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Pass `menuTextColor` to Nav in `src/app/layout.tsx`**

Replace the `<Nav>` call:

```tsx
<Nav
  role={session?.user.role}
  settings={{
    businessName: settings.businessName,
    menuColor: settings.menuColor,
    menuTextColor: settings.menuTextColor,
    hasLogo: settings.logoImage !== null,
  }}
/>
```

- [ ] **Step 3: Apply text colors in `src/app/page.tsx`**

Replace the entire `<main>` section:

```tsx
return (
  <main
    className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-slate-100 bg-cover bg-center px-4 text-center"
    style={settings.heroImage ? { backgroundImage: "url(/api/site-settings/hero-photo)" } : undefined}
  >
    <div className="rounded-lg bg-white/85 px-8 py-10 backdrop-blur-sm">
      <h1 className="text-3xl font-semibold" style={{ color: settings.textColor }}>
        {settings.businessName}
      </h1>
      {settings.tagline && (
        <p className="mt-2 text-lg" style={{ color: settings.textColor }}>
          {settings.tagline}
        </p>
      )}
      <Link
        href={cta.href}
        className="mt-6 inline-block rounded-md px-6 py-3 text-sm font-medium hover:opacity-90"
        style={{ backgroundColor: settings.ctaBackgroundColor, color: settings.ctaTextColor }}
      >
        {cta.label}
      </Link>
    </div>
  </main>
);
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
npm run build 2>&1 | head -30
```

Expected: No type errors.

---

### Task 4: Admin UI

**Files:**
- Modify: `src/app/admin/site-settings/page.tsx`

**Interfaces:**
- Consumes: API response from `/api/admin/site-settings` now includes the 4 new fields (Task 2).

---

- [ ] **Step 1: Update the `SiteSettingsResponse` interface and add state variables**

Replace the interface and state declarations at the top of the component:

```ts
interface SiteSettingsResponse {
  businessName: string;
  tagline: string;
  backgroundColor: string;
  menuColor: string;
  menuTextColor: string;
  textColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  hasLogo: boolean;
  hasHeroPhoto: boolean;
}

// Inside the component, add these four state variables alongside the existing ones:
const [menuTextColor, setMenuTextColor] = useState("#ffffff");
const [textColor, setTextColor] = useState("#0f172a");
const [ctaBackgroundColor, setCtaBackgroundColor] = useState("#0f172a");
const [ctaTextColor, setCtaTextColor] = useState("#ffffff");
```

- [ ] **Step 2: Populate state in `load()` and send fields in `save()`**

In the `load` function, extend the `.then` callback to set the new fields:

```ts
.then((data: SiteSettingsResponse) => {
  setSettings(data);
  setBusinessName(data.businessName);
  setTagline(data.tagline);
  setBackgroundColor(data.backgroundColor);
  setMenuColor(data.menuColor);
  setMenuTextColor(data.menuTextColor);
  setTextColor(data.textColor);
  setCtaBackgroundColor(data.ctaBackgroundColor);
  setCtaTextColor(data.ctaTextColor);
});
```

In the `save` function, after `formData.set("menuColor", menuColor);` add:

```ts
formData.set("menuTextColor", menuTextColor);
formData.set("textColor", textColor);
formData.set("ctaBackgroundColor", ctaBackgroundColor);
formData.set("ctaTextColor", ctaTextColor);
```

- [ ] **Step 3: Add the four color pickers to the form**

Add a new section after the existing "Color del menú" label and before the "Logo" label:

```tsx
<fieldset className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
  <legend className="px-1 text-sm font-semibold text-slate-700">Colores de texto</legend>
  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
    Texto del menú
    <input
      type="color"
      value={menuTextColor}
      onChange={(e) => setMenuTextColor(e.target.value)}
    />
  </label>
  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
    Texto de portada
    <input
      type="color"
      value={textColor}
      onChange={(e) => setTextColor(e.target.value)}
    />
  </label>
  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
    Fondo del botón principal
    <input
      type="color"
      value={ctaBackgroundColor}
      onChange={(e) => setCtaBackgroundColor(e.target.value)}
    />
  </label>
  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
    Texto del botón principal
    <input
      type="color"
      value={ctaTextColor}
      onChange={(e) => setCtaTextColor(e.target.value)}
    />
  </label>
</fieldset>
```

- [ ] **Step 4: Run full test suite to confirm nothing is broken**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

1. Go to `/admin/site-settings`.
2. Change "Texto del menú" to `#000000` (black) and save.
3. Confirm the nav text turns black.
4. Change "Texto de portada" to `#2563eb` (blue) and save.
5. Confirm the business name and tagline on `/` are blue.
6. Change "Fondo del botón principal" to `#16a34a` (green) and save.
7. Confirm the CTA button on `/` is green.
8. Reload the page — confirm colors persist.
