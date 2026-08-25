# Project Guidelines - OMAM

## Project Overview
OMAM is a time-tracking / attendance mobile application with a backend API.
- **Frontend**: React Native + Expo (mobile app)
- **Backend**: Elysia.js + Prisma + SQLite
- **Goal**: Simple offline-first attendance and work session tracking with authentication and reporting.

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
- Uses **Prisma** as ORM.
- Database: **SQLite** (file-based `dev.db`).
- All routes, services, and schemas must be in TypeScript.
- Prisma schema is the single source of truth for data models.

### 4. Database & Prisma
- Always update `prisma/schema.prisma` when changing data models.
- Run `npx prisma migrate dev` after schema changes.
- Never use raw SQL directly unless absolutely necessary.
- SQLite is used for local development; production can switch provider later.

### 5. Design System (Taraz)
- All UI is built from the **Taraz** design layer in `apps/mobile/src/design/taraz`, a React Native port of the Moview design system.
- Screens must not name a colour, type size, radius, spacing step or duration directly — import components and tokens from `src/design/taraz`.
- If a value is missing, add it to `tokens.ts`; never inline a hex value or a `fontSize`.
- Crimson (`accent`) is reserved for actions and active states. Semantics (success/warning/info) are for status only.
- Copy is sentence case, buttons are verbs, no emoji. See `src/design/taraz/README.md`.

### 6. Code Style & Quality
- Keep code concise and direct.
- No unnecessary comments unless requested.
- Follow existing naming and folder structure.
- Use proper typing everywhere — avoid `any`.
- Run lint and typecheck after changes.

### 7. Authentication & Security
- Token-based auth stored via AsyncStorage on mobile.
- Never commit secrets, tokens, or `.env` files.
- Always use the existing auth provider and API client.

### 8. Project Workflow Summary
1. Make changes in TypeScript only.
2. Update Prisma schema → run migrations when needed.
3. Test on Expo dev client (`npm run dev` or `expo start`).
4. Keep backend and frontend in sync with shared contracts (`packages/contracts`).
5. Prefer local SQLite for development.

## Additional Rules
- All previous instructions about removing JS files and using SQLite have been applied and must be maintained.
- Never introduce new JavaScript files in source directories.
- When adding new features, follow the existing provider + context pattern used in auth and language.

This file serves as the single source of truth for project conventions.
