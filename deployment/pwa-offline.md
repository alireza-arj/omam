# Offline PWA

The production PWA opens and records time without a network connection after its first complete online setup. Setup runs automatically in the background. For manual verification, keep the app online until its worker is activated in browser developer tools under **Application → Service workers**, then enable **Offline** and **Disable cache** in the Network panel and reload. Installation on the home screen is optional for offline startup. The browser must support service workers, Web Locks and the OPFS/SQLite features used by Expo; use HTTPS in production (localhost works for testing).

## Implementation plan and behavior

1. Export the Expo web app, then inject the manifest and mobile viewport metadata before building the service worker.
2. Generate a precache list from the actual web output: HTML, all web JavaScript bundles including the SQLite worker, CSS, WASM, bundled fonts, images, sounds and install icons. Exclude native bundles, source maps, metadata, API responses and manager/desktop paths.
3. Hash every resource with SHA-256. The resource list determines the versioned app cache. During installation, fetch all resources with browser integrity verification and bypass the HTTP cache. A missing resource, HTTP error, mismatched deployment or storage failure rejects installation; an existing working worker stays active.
4. Serve app navigations from the installed HTML, including deep links and query strings. Serve only the precached build resources from that version's cache, including byte-range responses for bundled audio. Startup does not wait for a failed or slow network. API traffic and private resources pass through without being stored by the worker.
5. Keep authentication, preferences and sessions in their existing local stores. Local reads, timer start/stop and edits work offline; the existing sync queue retries on reconnect. Team sign-in, team changes, password changes for linked accounts and server notifications still need connectivity. Payroll locks continue to be enforced locally and by sync.
6. Register independently of notification permissions. Check the complete cache on startup/resume, request persistent browser storage when supported and repair an incomplete cache when online. Registration retries on reconnection. Browser storage permission denial never blocks the app. These operations run without a profile card or user controls.
7. Download updates in the background. Do not force activation or reload a running app. A complete update waits until **all** tabs and installed app windows close; reopening uses the new build. Activation removes only older Tarazkar app caches. SQLite, local storage and unrelated origin caches stay intact. The legacy registration asset remains available for clients running older cached HTML.

The first download needs internet. Private browsing, storage eviction or manually clearing site data can remove offline resources; clearing site data also removes local records. Persistent storage is a browser decision, not a guarantee. Backups and server sync remain important for unsynced records.

## Build and automated verification

```sh
bun run --cwd apps/mobile build:web
bunx --no-install playwright install chromium
bun run --cwd apps/mobile test:pwa
bun run typecheck
bun run test
bun run --cwd apps/api test:desktop:isolated
```

If Chromium is already installed separately, set `PWA_CHROMIUM_EXECUTABLE` to its executable path for `test:pwa`. Browser tests serve the actual production output with the same cross-origin isolation headers as Nginx and an empty browser profile. They cover offline reload, reopening after all windows close, a full browser-process restart with the server unavailable and HTTP caching disabled, restored login and timer, local writes, unvisited routes, Persian fonts/RTL, API exclusion, failed updates and deferred activation. Worker unit tests also cover scoped cache cleanup, byte ranges and incomplete-cache repair. Run the smoke suite against a disposable PostgreSQL database; the isolated runner creates and removes its own database.

During verification on 2026-10-26, the unchanged API smoke fixture `a locked month refuses a pushed row` failed: its `day(5)` timestamp belongs to `1405-07`, while the test locks `1405-08`. This is a date-dependent fixture mismatch; the local payroll-lock tests and earlier API lock checks passed. The API behavior and that fixture are unchanged by this PWA work.

Deploy the entire `apps/mobile/dist` directory as one release. Keep `/sw.js` revalidating and preserve the COOP/COEP headers on cached HTML and SQLite resources. Do not rewrite missing JavaScript/WASM requests to successful HTML responses; integrity checks deliberately reject them.

## Phone acceptance checks

- Android Chrome: open the deployed HTTPS app, verify the worker is activated through remote developer tools, add it to the home screen, start a timer, close it, enable airplane mode and reopen. Stop the timer, view reports, edit a record and reopen again. Verify the record survives.
- iOS Safari: repeat from the installed home-screen app; verify Persian fonts, direction, safe areas and startup after Safari/app termination.
- Reconnect and verify pending time syncs exactly once. Confirm edits to a payroll-locked month still fail.
- Deploy a new build while a timer is running. Verify the new worker waits after installation, partial downloads leave the current app usable, and closing all app windows applies a complete update without losing the timer.

Background reminders require internet and browser/OS support. An offline PWA is not a background execution service; elapsed time is reconstructed from the saved session start instant when reopened.

Lifecycle and storage references: [service worker lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle), [Cache.addAll](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll), [persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
