# Tarazkar for macOS

An Apple Silicon menu-bar app with a 420 × 640 popover. It has no Dock icon or independent main window. Clicking the menu-bar clock opens the panel; clicking elsewhere or pressing Escape hides it. Quitting the app never stops a running work session.

The desktop renderer reuses the mobile attendance, authentication, team, calendar, translation, and sync providers. Timer and history have compact desktop controls; reports, profile, account, and team settings use the existing mobile screens within the panel. The panel follows the Taraz palette, uses macOS vibrancy, supports light/dark appearance and Persian RTL, and respects reduced motion, reduced transparency, and increased contrast. Frequent panel actions appear immediately; button feedback uses the shared 140 ms motion token.

The panel clock updates each second only while a running session is visible in Timer or History. Hiding the panel stops these UI updates; showing it recalculates elapsed time from the original start. Background synchronization and the menu-bar clock continue independently.

## Development

From the repository root:

```sh
bun install
bun run dev:desktop
```

The build exports a fresh mobile web renderer directly into the desktop app without running PWA injection or changing the mobile web output. PWA-only files are removed. The Electron main process, updater, shared contracts, and sandboxed preload are bundled and minified, so the installed app needs no runtime `node_modules`. Run `bun run build:desktop` to rebuild, then `bun run --cwd apps/desktop start` to open the result.

Desktop builds use Expo's experimental graph optimization and tree shaking. Metro selects the native desktop database provider, so browser SQLite workers and WebAssembly are excluded. Mobile and PWA builds keep their existing database providers and bundler settings. The 15 shared font faces are converted to WOFF2 at build time in the ignored `build/fonts` directory, retaining all weights and Persian glyphs. Font and bundled dependency notices are included in the installed archive.

`dist/release.json` records the package version, source Git revision, and build time. Release builds should use a clean checkout of the intended base revision plus the reviewed desktop changes; a revision alone does not describe uncommitted edits.

The renderer is served locally at `omam://app`. If the API uses a `CORS_ORIGINS` allow-list, include `omam://app` alongside the panel/web origins. Deploy the new API migration with `bun run db:deploy` before deploying clients that send device metadata.

## Sessions and storage

SQLite runs in the main process with WAL enabled. Parameters are bound, database requests are validated against shared contracts, filesystem attachment/extension loading are refused, and conflict resolution applies deletions and the chosen session in one local transaction. Account tokens and preferences are encrypted with Electron `safeStorage`; they are not stored in renderer local storage. Only the trusted main renderer frame can invoke the bridge, and Node integration is disabled.

Sessions store absolute start/end instants. Displayed elapsed time is calculated from the original start, so sleep, shutdown, hiding the panel, and quitting do not end the session. A session received from another device keeps its original identity and start time.

When linked and running, local changes request an immediate sync and the app polls incrementally every two seconds, including while the panel is hidden. Mobile operating systems may suspend a backgrounded app; it syncs again on activation. Team memberships refresh at most once a minute. Network failure leaves local work available for later synchronization.

Concurrent independent device timers are detected by a serializable API transaction. Rejected sessions and their overlapping counterparts appear as choices. Selecting a session marks the others deleted locally and queues those tombstones before the chosen row. Payroll-locked sessions cannot be modified or discarded. Device fields are optional for compatibility with older clients; deploy updated mobile clients to get conflict choices on both platforms.

## Verification

```sh
bun run typecheck
bun run test
bun run --cwd apps/api test:desktop:isolated
bun run build:desktop
bun run --cwd apps/desktop verify
```

The isolated smoke runner creates and removes a disposable PostgreSQL database using the configured development database credentials. It exercises the project's smoke suite plus cross-device start/stop, idempotency, simultaneous starts, completed offline overlaps, conflict deletion, and locked payroll protection.

The Electron check uses a separate temporary user-data directory. It captures light/dark/Persian screenshots in `output/playwright/desktop`, checks the sandbox, hidden Dock, package version, source revision and all 15 loaded fonts. It exercises timer start/stop, renderer reload, persisted sessions after application restart, manual creation/editing/soft deletion, conflict resolution, hidden-panel clock suspension, Escape, reports, settings, and reduced motion. For packaged apps it also checks that only English/Persian Chromium locales remain and no runtime `node_modules` was included. It does not replace release checks on a physical iPhone or a signed installation.

After packaging, set `OMAM_DESKTOP_EXECUTABLE` to the absolute path of `release/mac-arm64/Tarazkar.app/Contents/MacOS/Tarazkar` and run the same `verify` command to exercise the packaged app. Those screenshots go to `output/playwright/desktop-packaged`.

## DMG and release

For a local, unsigned Apple Silicon DMG:

```sh
bun run package:desktop:local
```

Artifacts are written to `apps/desktop/release`. Packaging keeps only English and Persian Chromium locales and uses bzip2-compressed DMGs to reduce download size. The minimum macOS version is 12. The Chromium runtime remains the largest part of the installed app. The local DMG is for testing; signing and notarization must be configured for distribution.

For a release, provide a Developer ID Application certificate through the build machine's keychain or the standard `CSC_LINK` / `CSC_KEY_PASSWORD` environment variables. Configure notarization with either `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, or `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`. Keep credentials outside the repository. Set `DESKTOP_UPDATE_URL` to the HTTPS generic update feed before building, increment the desktop package version, then run:

```sh
bun run package:desktop
```

Publish the generated DMG, ZIP, blockmaps, and `latest-mac.yml` to that feed. macOS updates require the signed ZIP as well as the DMG. Update checks run at startup and every six hours; installation is explicit so an update never silently closes the panel during use. The Settings check offers installation once a downloaded update is ready. Without a configured feed, update checks show the localized unavailable message.

Signing, notarization, and feed delivery require release credentials and hosting; they are not verified by an unsigned local build.

Implementation references: [Electron Tray](https://www.electronjs.org/docs/latest/api/tray), [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [electron-builder macOS](https://www.electron.build/mac/), and [automatic updates](https://www.electron.build/auto-update/).
