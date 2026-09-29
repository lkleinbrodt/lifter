# Lifter on your iPhone (personal use)

Personal device install. No TestFlight or App Store. Same setup as Artoo.

## Cheat sheet

| Goal | Command |
|------|---------|
| Dev with hot reload (Metro) | `npm start` |
| **OTA**: ship JS/TS/asset changes | `npm run update:ota -- "what changed"` |
| **Rebuild**: install a Release build on the phone | `npm run release:ios` |
| **Prebuild + rebuild**: native/icon/splash/plugin changes | `npm run release:ios:full` |

The installed build listens on OTA channel **`preview`** (set in `app.json` → `updates.requestHeaders`).

---

## 1. Ship JS/TS changes: OTA (most updates)

```bash
npm run update:ota -- "add rest timer"
```

This needs `eas-cli` (`npm i -g eas-cli`) logged in as `lkleinbrodt`, and it works from the Mac or from `chewy`. The app checks for updates on launch. It downloads an update on one launch and applies it on the next, so force-quit and reopen the app twice.

**When OTA is not enough:** if you change native code, add a native module or config plugin, change the icon or splash, or bump `version` in `app.json`, rebuild. `runtimeVersion` follows `version`, so after a version bump, OTAs only reach a build made with the new version.

## 2. Native rebuild: Release install on device

Installs a **Release** build with the JS embedded, so it runs without Metro or the laptop:

```bash
npm run release:ios
```

- Plug the phone in over USB (or use paired Wi-Fi) and **unlock it** before the install step.
- Signing uses team `DU26G2LJFP` (`ios.appleTeamId` in `app.json`), so there's no Xcode signing setup to do.
- First install only: on the phone, go to **Settings → General → VPN & Device Management** and trust the developer cert. Developer Mode must be on (**Settings → Privacy & Security → Developer Mode**).
- The dev provisioning profile expires after about a year. When the app stops launching, run `release:ios` again.

## 3. Regenerate native projects (prebuild)

`ios/` is gitignored and generated from `app.json`. Regenerate it when native config changes or `ios/` breaks:

```bash
npm run release:ios:full
```
