# Omam

Time tracking for a development team. People clock their hours on their phone;
whoever runs the team reviews them and closes the month out as payroll.

- `apps/mobile` — Expo app, offline-first, built on the Taraz design layer
- `apps/admin` — the web panel for managers and owners
- `apps/api` — Elysia API on PostgreSQL through Prisma
- `packages/contracts` — Zod schemas and DTO types shared by all three
- `packages/calendar` — Jalali and Gregorian arithmetic, no dependencies

## How it fits together

A member records time in the app, which writes to SQLite on the device and
keeps working with no network at all. When the account is linked to a team
server, the app pushes what changed and pulls what the server changed in one
round trip. Finished entries land in a review queue; a manager approves them
in the panel, and only approved time turns into pay.

At the end of the month the manager builds a payroll draft, adjusts any line
that needs a bonus or a deduction, and locks it. A locked month stops accepting
edits from every direction — panel, app and sync alike — so a figure that was
paid cannot move afterwards.

Dates are read in the organization's calendar, Jalali by default. Instants are
always stored as absolute ISO-8601, so switching calendars changes how a date
reads and never rewrites data.

## Run it locally

1. `bun install`
2. Start PostgreSQL and create a database (`createdb omam`).
3. `cp apps/api/.env.example apps/api/.env` and set `DATABASE_URL`.
4. `bun run --cwd apps/api db:migrate` then `bun run db:seed`.
5. `bun run dev:api` — the API on `http://localhost:3001`.
6. `bun run dev:admin` — the panel on `http://localhost:5173`.
7. `bun run dev:mobile` — the app in Expo Go, a simulator, or the browser.

Sign in to the panel with the owner from the seed
(`SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD`) and change that password first.

### Adding your team

1. In the panel, open **Invites** and create one per person.
2. Each member installs the app, creates their device account, opens
   **Profile → Team**, chooses *I have an invite*, and enters the server
   address and their code.
3. Set each person's rate under **Members**. Payroll uses the rate set there,
   never the one a member sets for themselves.

### Timezone

Month boundaries are computed in the API's own timezone, so run it with `TZ`
set to the team's — `Asia/Tehran` by default. A UTC process silently moves
three and a half hours of every month across the boundary.

## Deploy

`docker compose up -d --build` brings up PostgreSQL, the API and the panel.
Copy `.env.example` to `.env` first and set at least `POSTGRES_PASSWORD`,
`SEED_OWNER_PASSWORD` and `PUBLIC_API_URL`.

`PUBLIC_API_URL` is baked into the panel's bundle, so it has to be the address
browsers and phones actually reach — behind a TLS proxy that means `https://`.
Narrow `CORS_ORIGINS` to the panel's URL once it is public.

Migrations run forward on every boot (`prisma migrate deploy`), and the seed is
idempotent: it creates the first organization and owner once and then leaves
them alone.

## Checks

- `bun run typecheck` — all three apps
- `bun run test:smoke` — drives a running API through the whole product: sign
  in, invite, track, review, report, payroll, lock, and an offline device
  syncing through all of it. It makes its own fixtures each run, so it is safe
  to repeat against a development database.
- `bun test packages/calendar` — the calendar arithmetic

## Mobile API host

- `EXPO_PUBLIC_API_URL` overrides the address the app uses; otherwise a member
  types the server address once in **Profile → Team**.
- `EXPO_PUBLIC_API_PORT` is the development shortcut: the app resolves
  `localhost`, `10.0.2.2` on an Android emulator, or the browser's hostname on
  web.
