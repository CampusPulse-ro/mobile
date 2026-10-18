# CampusPulse mobile

Mobile client for CampusPulse, a campus companion for UPT students: timetable, exams,
a map of buildings and rooms, reminders and campus events. It talks to
[api](https://github.com/CampusPulse-ro/api), the same backend as
[web](https://github.com/CampusPulse-ro/web). Unofficial: not affiliated with UPT.

**Stack:** Expo SDK 57 · React Native 0.86 · TypeScript · expo-router (native tabs) ·
React Compiler · a **dev client**, so custom Swift/Kotlin modules are first-class ·
Bun · oxlint.

## Layout

| Path                    | What                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`              | Routes. `_layout` sets the navigation theme; `(tabs)/` = Today, Timetable, Map, Profile (placeholders)                                                                  |
| `src/components/ui.tsx` | Shared building blocks (`Screen`, `Title`, `Muted`, `Placeholder`)                                                                                                      |
| `src/theme.ts`          | Design tokens (colors, spacing, radius), generated from the web repo's `design/tokens.json` by `bun run design:tokens` ([docs/design-system.md](docs/design-system.md)) |
| `src/i18n/`             | Translations: English (default) and Romanian in `en.json` / `ro.json`, setup in `index.ts`, dates via `useDateTimeFormat()` in `format.ts`                              |
| `modules/`              | Custom native modules (Swift/Kotlin); see its README                                                                                                                    |
| `assets/images/`        | Placeholder icon and splash ("CP" lettermark)                                                                                                                           |

`ios/` and `android/` are **not committed**: `expo prebuild` generates them from
`app.json` + config plugins (Continuous Native Generation), and EAS does that on every build.

## Identity

- App id `ro.campuspulse.app` (Android package and iOS bundle id). It is permanent once
  published, so change it before the first store build if the domain changes.
- URL scheme `campuspulse`: the Campus Virtual sign-in hands the app its token at
  `campuspulse://token=…`.
- EAS project [`@thorsp/campuspulse`](https://expo.dev/accounts/thorsp/projects/campuspulse) (`owner` and
  `extra.eas.projectId` in `app.json`). Android signing credentials live on Expo's servers.

## Prerequisites

- [Bun](https://bun.sh) (the package manager and script runner)
- Git, and a GitHub account with access to the `CampusPulse-ro` org
- An Android phone with **Expo Go** (Google Play) on the same Wi-Fi as your computer. Later, once
  the app has native modules, a development build replaces Expo Go.

## Run it

```bash
bun install
bun start:go     # Expo Go: scan the QR code with the Expo Go app on your phone
bun start        # dev client: needs a dev build installed on the device/simulator
```

Expo Go works while there are no custom native modules.

A dev build made before i18n (#11) lacks AsyncStorage, which the saved language uses: build a
fresh dev client after pulling. Expo Go already has it.

### Development build

A development build is the app with our native code and the dev menu, installed on the phone like a
normal app; it loads the JavaScript from `bun start`.

- **Install it:** open the build page on the phone and tap **Install** (or scan its QR code):
  https://expo.dev/accounts/thorsp/projects/campuspulse/builds/004b63f0-292f-4d5f-8ce6-3b0b3de90674.
  Internal-distribution build pages open for anyone with the link.
- **First install gotchas:**
  - Android asks once to allow installing from the browser.
  - Play Protect may warn about an unknown app: **More details → Install anyway**.
  - A build you made locally with `bun run android` (debug-signed) won't install over the EAS
    build, or the other way round: uninstall the old one first.
  - If the phone can't reach your laptop (campus Wi-Fi often blocks it), use `bun start --tunnel`.
- **Make a new one** (after a native change, e.g. a new native package): `eas build -p android
--profile development` (`development-simulator` for the iOS simulator). The EAS project is on
  Sebastian's Expo account, so for now he runs it. Or build locally with `bun run android` (Android
  SDK) / `bun run ios` (Mac + Xcode).

### Which build talks to which API

| Build                        | API                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Development build or Expo Go | what `bun start` sees: `EXPO_PUBLIC_API_BASE` from the shell or a `.env.local` file; unset means stage |
| EAS `preview`                | stage, `https://campuspulse-api-stage.thorsp.net`                                                      |
| EAS `production`             | prod, `https://campuspulse-api.thorsp.net`                                                             |

To point your local app at another API, put `EXPO_PUBLIC_API_BASE=<url>` in `.env.local` (ignored by
git) and restart `bun start`. A release bundle built outside `eas.json` with no variable set fails at
startup instead of quietly using stage. The URL is read only in `src/config.ts`; never write an API
URL anywhere else.

## API

The app talks to the CampusPulse API through a typed client generated from the API's committed
OpenAPI contract:

```bash
bun run api:types    # regenerate src/api/schema.d.ts from the api repo's main, then commit it
```

Which API a build uses: `src/config.ts` (stage for development and preview, prod for production).
How screens call it: CONTRIBUTING, "Calling the API".

## Releasing

- Tags are `vX.Y.Z` (semver). Only admins can create `v*` tags (a tag ruleset).
- The app's `version` in `app.json` matches the release tag: bump it in the PR that prepares the
  release.
- Android version codes come from EAS automatically (`appVersionSource: "remote"`, `autoIncrement`
  on the `production` profile), so they never collide.
- **A GitHub Release does not build or submit the app yet.** Production builds and store submission
  come with the Google Play decision.
- Cut one with `gh release create vX.Y.Z --generate-notes`; the notes are grouped by label
  (`.github/release.yml`): features, fixes, dependencies, other.

Before a production build, run `bun run api:check:prod`: it checks that the committed API types match
the contract the **prod** API serves. If it fails, the app uses an endpoint prod doesn't have yet:
release the API first.

## Campus Virtual

Profile can connect the student's own Campus Virtual (cv.upt.ro) account. Code: `src/campusVirtual/`.

- **How it signs in:** the app opens Campus Virtual's mobile sign-in page (`launch.php`, the same
  flow the official Moodle app uses) in a browser tab. The student signs in with their UPT
  Microsoft account there, so the app never sees the password. Campus Virtual sends the app a web
  service token at `campuspulse://token=…`. The app keeps it only if it belongs to the attempt it
  started: `siteid` = md5(site URL + passport), with the passport from the platform's secure random
  generator.
- **That URL is a credential:** `src/app/+native-intent.tsx` keeps expo-router from routing to it
  (a cold start with it opens Profile), and the not-found screen never prints a link.
- **What's stored:** only that token, in the phone's secure storage (`expo-secure-store`, key
  `campusVirtual.token`, this device only, never in a backup). It never goes to our API and is
  never logged. A reinstall starts disconnected. Disconnect forgets it on the phone; it stays valid
  on UPT's side until it expires (neither the app nor the student can revoke it).
- **Read-only:** the token is full access to the student's account (it could submit quizzes), so
  `src/campusVirtual/client.ts` calls only the functions on its allow-list
  (`core_webservice_get_site_info` for now). Add a function there only if it only reads, and never
  `tool_mobile_call_external_functions` (it calls other functions, bypassing the list),
  `tool_mobile_get_autologin_key` (it turns the token into a browser session) or any `*_view_*`
  function (they record views and activity completion).
- **Lifetime:** it is the same token the official Moodle app holds for the student (Moodle keeps
  one per user), so it expires when that one does: UPT's token duration (Moodle's default is 12
  weeks) from whichever app connected first, possibly sooner than 12 weeks after connecting here.
  It can't be refreshed: when Campus Virtual answers `invalidtoken` or `accessexception`, the app
  forgets it and shows **Reconnect**.
- **Known limit (Android):** any app can register `campuspulse://`. Moodle's flow has no PKCE and
  doesn't allow https App Links for it, so the siteid check ties the redirect to this attempt but
  can't stop another installed app from also receiving it. That is the same exposure as the
  official Moodle app's `moodlemobile://`. iOS isn't affected: the auth session hands the redirect
  only to the app that opened it.
- **Which build:** the `campuspulse://` redirect needs a build that has that scheme, so test it on
  the **dev build**, not Expo Go.

## Checks

`bun run format` (`format:check` in CI) · `bun run lint` · `bun run typecheck` · `bun run doctor`.
CI (`lint, typecheck & bundle`) runs them all and also bundles the JS for iOS and Android.

## Contributing

- [`CONTRIBUTING.md`](CONTRIBUTING.md): the branch → PR → squash-merge workflow and the code standards
- [`docs/ai-development.md`](docs/ai-development.md): how to work with AI tools on this repo
- [`docs/ai-context.md`](docs/ai-context.md): the project context to give an AI at the start of a chat
