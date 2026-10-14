# CampusPulse mobile

Mobile client for CampusPulse, a campus companion for UPT students: timetable, exams,
a map of buildings and rooms, reminders and campus events. It talks to
[api](https://github.com/CampusPulse-ro/api), the same backend as
[web](https://github.com/CampusPulse-ro/web). Unofficial: not affiliated with UPT.

**Stack:** Expo SDK 57 · React Native 0.86 · TypeScript · expo-router (native tabs) ·
React Compiler · a **dev client**, so custom Swift/Kotlin modules are first-class ·
Bun · oxlint.

## Layout

| Path                    | What                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/`              | Routes. `_layout` sets the navigation theme; `(tabs)/` = Today, Timetable, Map, Profile (placeholders)                                     |
| `src/components/ui.tsx` | Shared building blocks (`Screen`, `Title`, `Muted`, `Placeholder`)                                                                         |
| `src/theme.ts`          | Design tokens (colors, spacing, radius), the same names and values as the web app                                                          |
| `src/i18n/`             | Translations: English (default) and Romanian in `en.json` / `ro.json`, setup in `index.ts`, dates via `useDateTimeFormat()` in `format.ts` |
| `modules/`              | Custom native modules (Swift/Kotlin); see its README                                                                                       |
| `assets/images/`        | Placeholder icon and splash ("CP" lettermark)                                                                                              |

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

- **Install it:** open the latest Android development build on
  [expo.dev → Builds](https://expo.dev/accounts/thorsp/projects/campuspulse/builds) on the phone and
  tap **Install** (or scan its QR code). Android asks to allow installing from the browser once.
- **Make a new one** (after a native change, e.g. a new native package):
  `eas build -p android --profile development` (`development-simulator` for the iOS simulator), or
  locally with `bun run android` (Android SDK) / `bun run ios` (Mac + Xcode).

### Which build talks to which API

| Build                                             | API                                               |
| ------------------------------------------------- | ------------------------------------------------- |
| Expo Go / `bun start` (no `EXPO_PUBLIC_API_BASE`) | stage, `https://campuspulse-api-stage.thorsp.net` |
| EAS `development`, `preview`                      | stage                                             |
| EAS `production`                                  | prod, `https://campuspulse-api.thorsp.net`        |

The URL comes from `EXPO_PUBLIC_API_BASE` per profile in `eas.json`, read in `src/config.ts`. Never
write an API URL anywhere else.

## Checks

`bun run format` (`format:check` in CI) · `bun run lint` · `bun run typecheck` · `bun run doctor`.
CI (`lint, typecheck & bundle`) runs them all and also bundles the JS for iOS and Android.

## Contributing

- [`CONTRIBUTING.md`](CONTRIBUTING.md): the branch → PR → squash-merge workflow and the code standards
- [`docs/ai-development.md`](docs/ai-development.md): how to work with AI tools on this repo
- [`docs/ai-context.md`](docs/ai-context.md): the project context to give an AI at the start of a chat
