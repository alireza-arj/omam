# OMAM Project Framework

## Goal

OMAM is an offline-first attendance and work-session tracker with a mobile app and a local API.

## Required Stack

- Frontend: Expo + React Native in `apps/mobile`
- Backend: Elysia.js in `apps/api`
- ORM: Prisma
- Database: SQLite with the local development database at `apps/api/dev.db`
- Shared contracts: Zod schemas and exported DTO types in `packages/contracts`

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

## SQLite And Prisma

- `apps/api/prisma/schema.prisma` is the single source of truth for data models.
- SQLite is the development database provider.
- Update Prisma schema before changing persisted data shapes.
- After model changes, run Prisma migration/generate commands from `apps/api`.
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
