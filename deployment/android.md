# Android APK for Cafe Bazaar and Myket

`bun run build:android:apk` builds the `market` EAS profile: a signed release APK,
store distribution, production environment, and `https://omam.ir/api`.
It runs independently of Expo Go and Metro. The Android package is `com.omam.app`.

EAS uses this project's existing remote Android keystore and increments the local
`expo.android.versionCode` for each build. Keep that keystore for every update;
do not replace it or commit signing credentials to Git.

If cloud uploads are unavailable, install Android SDK 36, build tools 36.0.0,
NDK 27.1.12297006, CMake 3.22.1, and Java 21, then use EAS local build:

```sh
mkdir -p output/releases
cd apps/mobile
eas build --platform android --profile market --local \
  --output ../../output/releases/tarazkar-bazaar.apk
```

Set `ANDROID_HOME` and `JAVA_HOME` to the local SDK and JDK paths.
The APK and verification files belong in the ignored `output/releases` directory.

Before uploading, verify the APK signature with `apksigner`, confirm its
`versionCode` exceeds the previous release, inspect the final manifest permissions,
and install it over the previous APK on an Android device. Check startup, account
creation, offline time tracking, restart persistence, avatar selection, and sync.
Run `bun run typecheck`, `bun run test`, and `bun run test:smoke` against an isolated
development API. Store listing copy, screenshots, support contact, privacy
disclosure, and the developer account are handled separately in the store panel.

## Over-the-air updates

The app uses `expo-updates` and the existing EAS project. The `market` profile
inherits the `production` channel, while internal preview APKs use `preview`.
Both build and update commands select the corresponding EAS environment, where
the public `EXPO_PUBLIC_API_URL` is `https://omam.ir/api`. Values in a build
profile's `env` are not automatically included by `eas update`.

Existing APKs released before this setup cannot receive OTA updates. Build a new
`market` APK with `bun run build:android:apk`, verify it over the installed
version, and publish it to Cafe Bazaar with the existing signing key. Users must
install this release once to enable OTA updates.

For later JavaScript, TypeScript, and asset changes, run these commands from the
repository root:

```sh
bun run build:android:preview
bun run update:android:preview --message "Fix session reminder"
bun run update:android:production --message "Fix session reminder"
```

Build and install the preview APK once per native runtime. Test the preview OTA
before publishing the same source and dependencies to production. A development
client or Expo Go does not reproduce the release app's automatic update flow.
Check startup while online, close and reopen after the update finishes
downloading, and verify the new behavior. Also check offline startup and that
local sessions and account data survive the update.

The app checks for updates on launch without waiting for the network. It starts
with its embedded or previously downloaded bundle; a new download is normally
used on the next launch. It does not force a reload during a running work
session. The embedded bundle remains available for offline startup.

Native release apps show an update dialog when EAS reports an available or
downloaded update. Users can download it, then explicitly restart the app to
apply it, or continue and fully close and reopen later. No restart is forced.
The dialog is translated into English and Persian and is disabled on web,
Expo Go, and builds without Expo Updates enabled. Existing installations only
gain this dialog after first applying the release that contains it.

The `fingerprint` runtime policy only delivers updates to compatible native
builds. Adding or changing native libraries, Expo SDK, permissions, or native
configuration requires another APK release. Compare the runtime fingerprint
with the target build before publishing; do not override it to force delivery.
OTA database changes still require backward-compatible local migrations.

Inspect releases and channels from `apps/mobile` with `eas update:list` and
`eas channel:list`. To roll a runtime back to its bundled APK code:

```sh
cd apps/mobile
eas update:roll-back-to-embedded --channel production --platform android \
  --runtime-version <target-build-runtime> --message "Restore embedded release"
```

Use the affected build's runtime from EAS, which may differ from the current
working tree. A rollback is delivered through the same update checks and needs
connectivity. See [EAS Update](https://docs.expo.dev/eas-update/introduction/)
and [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

## Size optimizations

Release builds enable R8 minification and resource shrinking, compress the Hermes
bundle, and compress native libraries with `useLegacyPackaging`. Android extracts
those libraries during installation: this reduces the downloaded APK, not the
size of the native code on disk. All four original ABIs are retained
(`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`); the APK is universal, not ARM-only.
Native ELF alignment must still be checked on a 16 KB device.

Font imports use per-weight package paths, so Metro packages only the 15 faces
used by Taraz rather than every weight exported by each font package. The Persian
Vazirmatn faces are retained. Unreferenced legacy image assets and their generator
were removed; those files were not part of the existing runtime bundle.

If a local Gradle mirror has an incomplete BlurView artifact, resolve
`com.github.Dimezis` exclusively from `https://jitpack.io` with a task-local Gradle
init script. The Expo-generated build already includes JitPack; the workaround is
only needed when a machine-wide init script puts a mirror ahead of it.
