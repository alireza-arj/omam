# Dokploy deployment

Build the repository root with `Dockerfile`, stage `deployment`, context `.`.
Route `omam.ir`, `www.omam.ir` and `panel.omam.ir` to container port `80`, path `/`, with HTTPS and Let's Encrypt. `panel.omam.ir` serves the panel at its root; `omam.ir/admin/` also remains available.

| Path | Service |
| --- | --- |
| `/` | Expo mobile/web PWA |
| `/admin/` | Manager panel |
| `/api/` | API, forwarded internally to port 3001 |
| `/api/health` | Database and API health |
| `/electron/` | Reserved macOS release endpoint; currently reports `RELEASE_PENDING` |

Use a separate PostgreSQL 17 service on the private Dokploy network, with persistent storage and no external database port. Copy the variables from `deployment/.env.example` into the application's environment, replacing the database connection and owner password. The application applies migrations and seeds the initial organization and `admin` once; an existing account is preserved.

The panel uses `/api`, with `/admin/` as its router and asset base. The PWA resolves `/api` against the current HTTPS origin automatically; members never enter a server address. Native Expo and Electron builds use `https://omam.ir/api` by default. To change it, set an absolute `EXPO_PUBLIC_API_URL` before building. Native application packaging is separate from web hosting.

The macOS installer is intentionally not published yet. After signing and verifying a release, place its artifacts under `deployment/electron/` and update the exact `/electron/` location in `deployment/nginx.conf` to serve or redirect to the installer. Keep installer artifacts out of Git. If enabling Electron updates later, publish the signed ZIP, blockmaps and `latest-mac.yml` and set `DESKTOP_UPDATE_URL` before packaging.

The PWA service worker bypasses the API, panel and Electron paths. Nginx sends the cross-origin isolation headers required by browser SQLite, preserves deep links, and serves the API without caching.

Verify `/api/health`, both English and Persian login pages, offline PWA timer persistence, manager authentication and roles, and synchronization after deployment. Run the destructive smoke suite only on its disposable database through `bun run --cwd apps/api test:desktop:isolated`.
