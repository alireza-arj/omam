# Dokploy deployment

Build the repository root with `Dockerfile`, stage `deployment`, context `.`.
Route `omam.ir`, `www.omam.ir` and `panel.omam.ir` to container port `80`, path `/`, with HTTPS and Let's Encrypt. `panel.omam.ir` serves the panel at its root; `omam.ir/admin/` also remains available.

The `deployment` image contains the API as well as the static frontends. Its runtime uses Debian slim and a single Bun executable copied from the pinned official image; Node, npm, npm's cache, Expo, Electron and frontend build tools stay out of it. Each builder installs only its workspace's dependencies. API dependencies are installed from scratch with `--production --filter @omam/api`; Prisma remains a production dependency because startup applies migrations. The API and seed are bundled and minified without source maps. BuildKit keeps package downloads in a separate cache mount, outside image layers. This follows [Bun's multi-stage Docker guidance](https://bun.com/guides/ecosystem/docker).

The `admin` and `mobile-web` targets contain only Nginx and static files. Use `deployment` for the existing Dokploy setup; switching it to a frontend-only target would omit the API. Keep Bun's version in the Dockerfile aligned with the root `packageManager`.

To build and inspect the final image on a Docker host:

```sh
docker build --target deployment -t tarazkar:local .
docker image inspect tarazkar:local --format '{{.Size}}'
docker history tarazkar:local
docker run --rm --entrypoint sh tarazkar:local -ec '
  bun --version
  nginx -t
  test ! -e /app/node_modules/expo
  test ! -e /app/node_modules/electron
  test ! -d /usr/local/lib/node_modules
  test ! -d /root/.npm
  test ! -d /root/.bun/install/cache
  test ! -d /app/apps/api/src
  test -s /app/apps/api/dist/index.js
  test -s /app/apps/api/dist/seed.js
  test -s /app/node_modules/.prisma/client/index.js
  du -sh /app/node_modules /usr/local/bin/bun /usr/share/nginx/html
'
```

Image size, old images, build cache, container logs and database volumes consume disk separately. After a successful redeploy, use `docker system df -v` and `docker buildx du` to identify what remains. Remove obsolete application image tags explicitly with `docker image rm <old-tag>`. Build cache is reusable but optional; `docker builder prune --filter until=168h` interactively removes unused cache older than a week across that builder. This does not remove database volumes. A smaller rebuild does not automatically remove the previous image or its cached build layers.

| Path | Service |
| --- | --- |
| `/` | Expo mobile/web PWA |
| `/admin/` | Manager panel |
| `/api/` | API, forwarded internally to port 3001 |
| `/api/health` | Database and API health |
| `/electron/` | Reserved macOS release endpoint; currently reports `RELEASE_PENDING` |

Use a separate PostgreSQL 17 service on the private Dokploy network, with persistent storage and no external database port. Copy the variables from `deployment/.env.example` into the application's environment, replacing the database connection and owner password. The application applies migrations and seeds the initial organization and `admin` once; an existing account is preserved.

The panel uses `/api`, with `/admin/` as its router and asset base. The PWA resolves `/api` against the current HTTPS origin automatically; members never enter a server address. Native Expo and Electron builds use `https://omam.ir/api` by default. To change it, set an absolute `EXPO_PUBLIC_API_URL` before building. Native application packaging is separate from web hosting.

The macOS installer is intentionally not published yet. `deployment/electron/` is excluded from the Docker context so local installers cannot silently inflate the server image. After signing and verifying a release, publish its artifacts to separate release or object storage and update the exact `/electron/` location in `deployment/nginx.conf` to redirect to the installer. Keep installer artifacts out of Git. If enabling Electron updates later, publish the signed ZIP, blockmaps and `latest-mac.yml` and set `DESKTOP_UPDATE_URL` before packaging.

The PWA service worker bypasses the API, panel and Electron paths. Nginx sends the cross-origin isolation headers required by browser SQLite, preserves deep links, and serves the API without caching.

Offline startup, versioned precaching, update activation and verification are documented in [pwa-offline.md](pwa-offline.md). After the first complete online setup, the PWA can reopen and record time without internet. Setup and updates run automatically in the background.

Mobile, PWA and Electron sync after local changes, on startup/resume and after reconnecting. An authenticated WebSocket at `/api/sync/events` sends change hints; devices fetch the actual rows through `/api/sync`. Idle devices send only a lightweight heartbeat every 25 seconds, with no periodic session polling. Failed syncs and notification connections retry with backoff up to one minute. Native apps reconnect when brought back to the foreground; Electron stays connected while its panel is hidden.

Keep WebSocket upgrades enabled on any proxy in front of Nginx. Across API replicas, PostgreSQL `LISTEN`/`NOTIFY` distributes hints for sessions, panel edits and payroll locks. The API needs a direct PostgreSQL connection (or session pooling) for its notification listener; transaction-mode pooling is unsuitable for `LISTEN`. A reconnect always triggers a catch-up sync, so missed hints do not discard offline changes.

PWA notifications are enabled from **Profile → Notifications**. On iOS/iPadOS 16.4+, add the app to the Home Screen in Safari and open the installed app before enabling notifications. Android supports notifications in compatible HTTPS browsers. Start/stop confirmations work locally after permission is granted.

For reminders while the PWA is closed, run `bun run --cwd apps/api push:keys` once and save `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and a valid `WEB_PUSH_SUBJECT` (`mailto:` contact or HTTPS URL) in the deployment environment. Keep the private key secret and preserve the same pair across deploys and replicas. Restart the API after configuring them. The API checks every minute and sends a reminder after two hours, then every two hours, for the browser device’s synced, open, non-deleted sessions. Revoked or expired logins and suspended memberships receive no reminders. Expired push subscriptions are soft-deleted. Multiple API instances claim a delivery in PostgreSQL before sending.

Background reminders require a team connection and internet. Offline-only sessions cannot schedule closed-app notifications, and an offline clock-out must sync before the server knows to stop reminders. Push delivery is controlled by the browser/OS; reminders expire after five minutes to limit stale delivery. Disabling notifications or signing out unsubscribes this browser. The profile reports when the server has no Web Push configuration; local confirmations remain available.

Verify `/api/health`, both English and Persian login pages, offline PWA timer persistence, manager authentication and roles, and synchronization after deployment. Run the destructive smoke suite only on its disposable database through `bun run --cwd apps/api test:desktop:isolated`.
