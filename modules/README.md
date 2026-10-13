# Native modules

Custom Swift / Kotlin code lives here, one folder per module, written with the
[Expo Modules API](https://docs.expo.dev/modules/overview/). Expo autolinks every
module in this folder, so there is no registration step. Write the Swift side as well as
the Kotlin one: only Android ships for now, but iOS must keep building.

```bash
bunx create-expo-module@latest --local <name>   # scaffolds modules/<name>/{ios,android,src}
```

A new or changed module needs a **new dev build** (`eas build --profile development`):
JS reloads instantly, native code only arrives with a build. Once a module exists,
Expo Go can no longer run the app; use the dev client (`bun start`).
