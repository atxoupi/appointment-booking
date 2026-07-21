# Design: Site Branding & Role-Based Navigation

**Date:** 2026-07-12
**Status:** Approved, pending implementation plan

## Context and goal

The app currently ships with the untouched `create-next-app` boilerplate as its landing page, no shared navigation, and no styling beyond bare HTML (see `src/app/page.tsx`, `src/app/login/page.tsx`, etc.). Every page is reachable only by typing its URL; there's no way for a logged-in user to navigate between the pages relevant to their role, and the business has no way to put its own branding (name, colors, logo, photo) on the site without editing code.

This project adds:
1. A site-wide navigation menu with links that change based on who's logged in (or logged out).
2. A modern, Tailwind-styled landing page for the business.
3. An admin-configurable "site settings" panel: background color, menu color, logo, hero photo, business name, and tagline.
4. A light Tailwind styling pass on the rest of the app's existing pages, so they're visually consistent with the new nav and landing page.

This is a single-tenant app (per the original [appointment booking design](2026-07-10-appointment-booking-design.md)), so "site settings" is a single global row, not per-user or per-tenant configuration.

## Data model

New table, a singleton row (fixed `id`):

```prisma
model SiteSettings {
  id              String   @id @default("singleton")
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

**Image storage:** uploaded images (logo, hero photo) are stored as `Bytes` directly in Postgres, not on the filesystem or an external object store. This avoids a new external dependency/service and works identically whether the app is deployed on Vercel (ephemeral filesystem) or a VPS. Uploads are capped at 2MB and restricted to `image/png`, `image/jpeg`, `image/webp` — SVG is deliberately excluded since an uploaded SVG can embed scripts.

`getSiteSettings()` returns the singleton row, falling back to the schema defaults if no row exists yet (no seed migration needed — first admin save creates the row via upsert).

## Service layer & API

Following the existing pattern (`src/lib/*-service.ts` holds logic, API routes are thin):

- `src/lib/site-settings-service.ts`
  - `getSiteSettings(db?: PrismaClient): Promise<SiteSettings>` — upserts/returns the singleton, applying defaults if absent.
  - `updateSiteSettings(data: Partial<...>, db?: PrismaClient): Promise<SiteSettings>` — upserts the singleton row with new values.
- `PATCH /api/admin/site-settings` — admin-only (checks `session.user.role === "ADMIN"`). Accepts a single `multipart/form-data` request with text fields (`businessName`, `tagline`, `backgroundColor`, `menuColor`) and optional file fields (`logo`, `heroPhoto`), parsed via Next's built-in `request.formData()` — no new multipart-parsing dependency needed. Validates file size/mimetype before calling the service.
- `GET /api/site-settings/logo` and `GET /api/site-settings/hero-photo` — public, unauthenticated routes that stream the stored bytes with the correct `Content-Type` header (404 if not set). Used as `<img src>` targets anywhere in the app, including the public landing page.
- New admin page `src/app/admin/site-settings/page.tsx`: form with text inputs for name/tagline, `<input type="color">` for background/menu color, file inputs for logo/hero photo with a live preview, and a save button — following the existing admin page patterns in `src/app/admin/*`.

## Site-wide layout & role-based navigation

- `src/app/layout.tsx` becomes an async server component that calls `getServerSession(authOptions)` and `getSiteSettings()`, then renders `<Nav role={session?.user.role} settings={settings} />` above `{children}`.
- `Nav` (`src/app/components/Nav.tsx`) is a client component — it needs the sign-out button — but receives `role` and `settings` as props rather than fetching them itself, avoiding a client-side flicker and a duplicate DB round trip.
- The link set per role is computed by a pure function, `getNavLinksForRole(role: Role | undefined): NavLink[]` in `src/lib/nav-links.ts`, unit-testable without rendering anything:
  - Logged out: Iniciar sesión, Registrarse.
  - `CLIENT`: Reservar cita (`/book`), Mis citas (`/my-appointments`), Cerrar sesión.
  - `WORKER`: Mi agenda (`/worker`), Cerrar sesión.
  - `ADMIN`: Servicios, Turnos, Asignaciones, Trabajadores, Citas, Ajustes del sitio, Cerrar sesión (the 5 existing admin sections plus the new site-settings page).
- The nav reserves a left-aligned logo slot rendered from `settings.logoImage` (via `/api/site-settings/logo`), falling back to `settings.businessName` as text if no logo has been uploaded.
- `settings.menuColor` is applied as the nav's background color; `settings.backgroundColor` is applied on the root layout's body/wrapper.
- The existing hardcoded `@media (prefers-color-scheme: dark)` block in `globals.css` is removed — color is now admin-controlled rather than OS-controlled. This is a deliberate small removal of current behavior (dark-mode auto-switching), not scope creep, since keeping it would conflict with an admin-chosen background color.

## Landing page redesign

`src/app/page.tsx` replaces the create-next-app boilerplate with a single hero section: `heroImage` (via `/api/site-settings/hero-photo`) as the background/featured image, `businessName` and `tagline` overlaid as text, and one CTA button — "Reservar cita" linking to `/book` for a logged-in `CLIENT`, "Iniciar sesión" otherwise. No services-preview grid or additional landing sections in this iteration.

## Light styling pass on existing pages

Tailwind CSS is added to the project (`tailwindcss`, `postcss`, `autoprefixer`, standard Next.js App Router setup — `tailwind.config.ts`, directives in `globals.css`). Login, register, book, my-appointments, worker, and all `admin/*` pages get a light pass: consistent Tailwind utility classes for forms, inputs, buttons, and spacing. This is styling only — no layout restructuring, no new fields, no behavior changes to these pages.

## Testing

- `tests/unit/nav-links.test.ts` — one case per role (logged out, CLIENT, WORKER, ADMIN) verifying `getNavLinksForRole` returns the expected link set.
- `tests/integration/site-settings-service.test.ts` — `getSiteSettings`/`updateSiteSettings` against the real test database, following the existing service-test pattern (real Postgres, not mocks).
- No new UI testing framework/dependency (no React Testing Library) is introduced for this project. Visual and styling changes are verified by running the dev server and checking each role's view manually, consistent with how the rest of the app has been built so far.

## Out of scope (for this iteration)

- Services-preview grid or any additional landing page sections beyond the hero.
- Broader theme palette (accent/button/text colors) beyond background + menu color.
- Restyling beyond a "light pass" — no redesign of existing page layouts or flows.
- Any image storage approach other than DB bytes (no filesystem, no external object storage).
- SVG logo/photo uploads.
