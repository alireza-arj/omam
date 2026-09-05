# Project Guidelines - OMAM

## Project Overview
OMAM is team time tracking: an offline-first mobile app, a manager's web panel, and an API.
- **Mobile**: React Native + Expo, local SQLite, syncs to the server when linked
- **Admin panel**: React + Vite in `apps/admin`, for managers and owners only
- **Backend**: Elysia.js + Prisma + PostgreSQL
- **Goal**: Everyone tracks their own hours; a manager reviews them and closes each month out as payroll.

## Core Rules (Must Follow)

### 1. TypeScript Only
- **Every file** in the project (frontend, backend, shared packages) **must be written in TypeScript**.
- No `.js` files are allowed in source code (`src/`, `app/`, `packages/`).
- Config files (babel.config.js, metro.config.js, tailwind.config.js) may remain `.js`.

### 2. Frontend Stack
- Built with **Expo** (React Native).
- Use TypeScript (`*.ts`, `*.tsx`).
- Follow existing component and provider patterns.
- All new components and screens must be in TypeScript.

### 3. Backend Stack
- Built with **Elysia.js**.
- Uses **Prisma** as ORM with the Postgres driver adapter.
- Database: **PostgreSQL**, in development and in production alike.
- All routes, services, and schemas must be in TypeScript.
- Prisma schema is the single source of truth for data models.
- Validate every request body with a schema from `@omam/contracts` via `parseInput`; do not hand-roll validation in a route.
- Deliberate failures are `AppError` (see `lib/errors.ts`); anything else becomes a 500.

### 4. Database & Prisma
- Always update `prisma/schema.prisma` when changing data models.
- Run `bun run --cwd apps/api db:migrate` after schema changes and commit the migration.
- Never use raw SQL directly unless absolutely necessary.
- Deletes are soft (`deletedAt`), because an offline device cannot see a row that simply vanished.

### 4a. Permissions And Payroll
- Roles are OWNER > MANAGER > MEMBER, checked with `requireRole`.
- Payroll counts **approved** time only, at the rate on `Membership` — never the rate a member sets for themselves.
- A locked payroll month refuses every later edit, from the panel, the app and sync. Do not add a path around it.

### 5. Design System (Taraz)
- All mobile UI is built from the **Taraz** design layer in `apps/mobile/src/design/taraz`, a React Native port of the Moview design system.
- The admin panel uses the same tokens ported to CSS variables in `apps/admin/src/styles/taraz.css`. Add a token there rather than inlining a value.
- Screens must not name a colour, type size, radius, spacing step or duration directly — import components and tokens from `src/design/taraz`.
- If a value is missing, add it to `tokens.ts`; never inline a hex value or a `fontSize`.
- Crimson (`accent`) is reserved for actions and active states. Semantics (success/warning/info) are for status only.
- Copy is sentence case, buttons are verbs, no emoji. See `src/design/taraz/README.md`.

### 6. Dates & Calendars
- The app reads dates in the **Jalali (Shamsi)** calendar by default; Gregorian is a per-user setting on `AppSettings.calendar`.
- All conversion, keys, ranges and month/weekday names live in `packages/calendar` (`@omam/calendar`) — dependency-free arithmetic, shared by the API and the app. Do not add a date library and do not use `Intl.DateTimeFormat` for a date; `Intl` is fine for a clock time or a number.
- Instants are always stored as absolute ISO-8601 strings. A calendar only decides how an instant is *read*, so switching calendars never rewrites data.
- Any function that produces a day key, a month key, a range or a date label takes a `CalendarSystem`. Screens get it from `useAttendance().calendar`.
- Month and week boundaries are calendar-dependent; day boundaries are not (both break at local midnight).

### 7. Code Style & Quality
- Keep code concise and direct.
- No unnecessary comments unless requested.
- Follow existing naming and folder structure.
- Use proper typing everywhere — avoid `any`.
- Run lint and typecheck after changes.

### 8. Authentication & Security
- Token-based auth stored via AsyncStorage on mobile.
- Never commit secrets, tokens, or `.env` files.
- Always use the existing auth provider and API client.

### 9. Project Workflow Summary
1. Make changes in TypeScript only.
2. Update Prisma schema → run migrations when needed.
3. Test on Expo dev client (`bun run dev:mobile`) and the panel (`bun run dev:admin`).
4. Keep all three apps in sync through the shared contracts (`packages/contracts`).
5. Run `bun run typecheck` and `bun run test:smoke` before shipping.

### 10. Sync
- The app is offline-first: every screen reads and writes local SQLite, and a linked server is an addition, never a requirement.
- The local row id is the `clientId` the server keys on, which is what makes a repeated push idempotent.
- Conflicts go to the newer `updatedAt`, except that a locked payroll month always wins and editing approved time returns it to the review queue.

## Additional Rules
- Never introduce new JavaScript files in source directories.
- When adding new features, follow the existing provider + context pattern used in auth and language.

This file serves as the single source of truth for project conventions.
