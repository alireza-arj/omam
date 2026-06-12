# Omam

Attendance and hourly-income tracker with:

- `apps/mobile`: Expo app with a custom visual system built on `NativeWind`
- `apps/api`: Elysia API with Prisma + SQLite
- `packages/contracts`: shared schemas and DTO types
- `PROJECT_FRAMEWORK.md`: project framework and engineering rules

## Stack

- Mobile: Expo Router, NativeWind, Reanimated, Skia
- API: Elysia, Prisma, SQLite
- Shared: Zod contracts

## Run

1. Install dependencies at the repo root with Bun: `bun install`.
2. In `apps/api`, copy `.env.example` to `.env` if needed.
3. Run `bun run db:generate` and `bun run db:push` at the repo root.
4. Start the API with `bun run dev:api`.
5. In `apps/mobile`, copy `.env.example` to `.env` if you need overrides.
6. Start the app with `bun run dev:mobile` and open it in Expo Go, simulator, or web.

### API Host Configuration

- API binds to `HOST` (default `0.0.0.0`) so devices on your LAN can reach it.
- Keep this in `apps/api/.env` for physical devices:
  `HOST=0.0.0.0`
- You can keep using `PORT` as before.
- Current detected LAN URL for this machine with the local `.env` port is `http://192.168.1.157:3010`; use your current LAN IP if it changes.

### Expo Go On Physical Phone

- Easiest option: in `apps/mobile/.env` use localhost and let the app rewrite host automatically from Metro:
  `EXPO_PUBLIC_API_URL="http://localhost:3001"`
- If your API port is different, either set full URL:
  `EXPO_PUBLIC_API_URL="http://localhost:3010"`
  or use:
  `EXPO_PUBLIC_API_PORT=3010`
- After changing `.env`, restart Expo (`bun run dev:mobile`) so env values refresh.

### Android Emulator / Android Device Notes

- If the app runs on a physical Android device, you can also set `EXPO_PUBLIC_API_URL` directly to your machine LAN IP and API port (for example `http://192.168.1.20:3010`).
- If the app runs on Android Emulator, use `http://10.0.2.2:<API_PORT>`.
- Optional for physical devices: `adb reverse tcp:<API_PORT> tcp:<API_PORT>` allows using localhost-style addresses from the phone.

### Web

- Start the API on the same host/port settings.
- Run `bun run --cwd apps/mobile web` or `bun run dev:mobile` and choose web.
- The mobile API client uses `window.location.hostname` with `EXPO_PUBLIC_API_PORT` unless `EXPO_PUBLIC_API_URL` is explicitly set.

## Notes

- The current mobile UI is an MVP shell focused on premium visual direction, not the full product surface.
- The next logical step is adding auth, session editing, and export/report generation.
