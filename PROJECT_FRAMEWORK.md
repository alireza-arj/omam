# OMAM Project Framework

## Goal

OMAM is team time tracking: an offline-first mobile app, an admin panel for managers, and an API that owns the shared record.

## Required Stack

- Mobile: Expo + React Native in `apps/mobile`
- Admin panel: React + Vite in `apps/admin`
- Backend: Elysia.js in `apps/api`
- ORM: Prisma with the Postgres driver adapter
- Database: PostgreSQL, in development and in production alike
- Shared contracts: Zod schemas and exported DTO types in `packages/contracts`
- Calendars: `packages/calendar`, the only place date arithmetic lives

## TypeScript Rules

- Source files in `apps/*/src`, `apps/mobile/app`, and `packages/*/src` must be TypeScript only.
- Use `.ts` for logic and `.tsx` for React components/screens.
- Do not add `.js` files under source directories.
- Existing config files such as Babel, Metro, and Tailwind may remain JavaScript.
- Keep `strict` TypeScript enabled and run typecheck before shipping changes.

## API And Contracts

- API routes must validate input with shared schemas from `@omam/contracts` where practical.
- Mobile requests must use the shared DTO types from `@omam/contracts`.
- Keep auth token handling inside the auth provider and API client.
- Keep API responses serializable: dates must cross the API as ISO strings.

## PostgreSQL And Prisma

- `apps/api/prisma/schema.prisma` is the single source of truth for data models.
- PostgreSQL is the provider everywhere; migrations are committed and run forward with `prisma migrate deploy`.
- Update Prisma schema before changing persisted data shapes.
- After model changes, run Prisma migration/generate commands from `apps/api` and commit the migration.
- Run the API with `TZ` set to the team's zone: month boundaries are computed in the host's local time.
- Do not use raw SQL unless there is a clear reason and Prisma cannot express the operation.

## Local Network Behavior

- API must bind to `0.0.0.0` by default so phone, simulator, web, and local clients can reach it.
- Mobile can use `EXPO_PUBLIC_API_PORT` and auto-resolve the correct host from Metro.
- Web uses the current browser hostname with `EXPO_PUBLIC_API_PORT`.
- Android emulator fallback is `10.0.2.2`.
- Physical devices can use the laptop LAN URL explicitly when needed.

## Quality Bar

- Keep components and providers aligned with the current auth/language/attendance context pattern.
- Prefer small typed helpers over loosely typed request or formatting code.
- Run backend and mobile typecheck after code changes.
- Run a build/export path before Docker-related changes are considered done.
