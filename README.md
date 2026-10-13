# CampusPulse mobile

Mobile client for CampusPulse, a campus companion for UPT students: timetable, exams,
a map of buildings and rooms, reminders and campus events. It talks to
[api](https://github.com/CampusPulse-ro/api), the same backend as
[web](https://github.com/CampusPulse-ro/web). Unofficial: not affiliated with UPT.

**Stack:** Expo SDK 57 · React Native 0.86 · TypeScript · expo-router (native tabs) ·
React Compiler · a **dev client**, so custom Swift/Kotlin modules are first-class ·
Bun · oxlint. Dark theme only.

## Layout

| Path | What |
|---|---|
| `src/app/` | Routes. `_layout` sets the dark theme; `(tabs)/` = Today, Timetable, Map, Profile (placeholders) |
| `src/components/ui.tsx` | Shared building blocks (`Screen`, `Title`, `Muted`, `Placeholder`) |
| `src/theme.ts` | Design tokens: the dark palette shared with the web app |
| `modules/` | Custom native modules (Swift/Kotlin); see its README |
| `assets/images/` | Placeholder icon and splash ("CP" lettermark) |

`ios/` and `android/` are **not committed**: `expo prebuild` generates them from
`app.json` + config plugins (Continuous Native Generation), and EAS does that on every build.

## Identity

- App id `ro.campuspulse.app` (Android package and iOS bundle id). It is permanent once
  published, so change it before the first store build if the domain changes.
- URL scheme `campuspulse`: the Campus Virtual sign-in hands the app its token at
  `campuspulse://token=…`.
- No EAS project yet: `eas init` adds `owner` and `extra.eas.projectId` to `app.json`.

## Run it

```bash
bun install
bun start:go     # Expo Go: works while there are no custom native modules
bun start        # dev client: needs a dev build installed on the device/simulator
```

Dev build: `eas build --profile development --platform android|ios`
(`development-simulator` for the iOS simulator), or locally with `bun run android`
(Android SDK) / `bun run ios` (Mac + Xcode).

## Checks

`bun run lint` · `bun run typecheck` · `bun run doctor`. CI (`lint, typecheck &
bundle`) also bundles the JS for iOS and Android.
