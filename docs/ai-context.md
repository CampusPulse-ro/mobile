# CampusPulse mobile: context for an AI assistant

> **Paste or upload this whole file at the start of every new AI chat about this repo**, then add the
> files you are working on. Tools that read the repo themselves (VS Code Copilot, Cursor and similar)
> are pointed here by `AGENTS.md`.

You are helping a student who is learning mobile development. Explain what you change and why, in
plain words. Keep each change small enough to read and test in a few minutes.

## The project

- **CampusPulse:** an unofficial campus companion for students of UPT (Politehnica University of
  Timișoara): timetable, exams, a map of buildings and rooms, reminders, and the student's own data
  from Campus Virtual (the university's Moodle). Not an official UPT app.
- **Three repositories:** `api` (the .NET backend, not edited from here), `mobile` (this one) and
  `web` (the React web app).
- **This repo:** Expo SDK 57, React Native 0.86, React 19, TypeScript in strict mode, expo-router
  (file-based routing), Bun as package manager, oxlint for linting. Android first; iOS has to keep
  compiling.

## Structure

| Path                    | What                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/app/`              | Screens. Each file is a route (expo-router). `(tabs)/` = Today, Timetable, Map, Profile               |
| `src/app/_layout.tsx`   | Root layout: navigation theme and stack                                                               |
| `src/components/ui.tsx` | Shared building blocks: `Screen`, `Title`, `Muted`, `Placeholder`                                     |
| `src/theme.ts`          | Design tokens: `color`, `space`, `radius`. The only place colors are defined                          |
| `src/i18n/`             | Translations: `en.json`, `ro.json` (same keys), `index.ts` (setup), `format.ts` (`useDateTimeFormat`) |
| `modules/`              | Native Kotlin/Swift modules                                                                           |
| `app.json`, `eas.json`  | App identity and build profiles                                                                       |

## Rules for your answers

1. **Follow the existing patterns.** Before writing a new screen or component, look at (or ask for)
   the closest existing one and match it.
2. **Style only with the tokens from `src/theme.ts`.** No hex colors or magic numbers in screens.
3. **Screens that load data handle four states:** loading, error with retry, empty, and data.
4. **No user-facing text written directly in components,** and that includes props such as
   `accessibilityLabel` and `placeholder` (oxlint's `react/jsx-no-literals` only catches text
   children). Every text is a key in BOTH `src/i18n/en.json` and `src/i18n/ro.json`, used with
   `const { t } = useTranslation()` and `t('section.key')`; a key in only one file, or an unknown
   key, fails the typecheck. Romanian uses ș ț with a comma below, never ş ţ with a cedilla (CI
   checks). The `language.*` names stay in their own language in both files ("Română" in
   en.json) on purpose. English is the default language. Dates and times: the
   `useDateTimeFormat()` hook from `src/i18n/format.ts` (campus time, the app's language).
5. **No new packages unless I ask.** If one is truly needed, say so and why, and use
   `bunx expo install <name>` so the version matches Expo SDK 57.
6. **The backend is called only through the generated API client.** Never `fetch` with a URL written
   by hand. If the client or the endpoint you need doesn't exist yet, say so; do not invent one.
7. **Don't invent APIs.** If you are not sure a prop, function or library exists in Expo SDK 57 /
   React Native 0.86, say that you are not sure.
8. **Strict TypeScript:** no `any`, no `@ts-ignore`, no disabling lint rules to make an error go away.
9. **Imports use the `@/` alias** (`@/components/ui`, `@/theme`). Formatting is done by Prettier
   (`bun run format`), so don't spend effort on spacing or line breaks.
10. **Show complete code with its file path,** or an exact before/after, and say exactly where it goes.
11. **Never put secrets in code:** passwords, tokens, API keys.
12. **Don't change** `app.json` identity (`ro.campuspulse.app`, scheme `campuspulse`), `eas.json`,
    `.github/`, `modules/`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.gitattributes`,
    `.vscode/` or package versions. Those belong to Sebastian; tell me if a change there
    seems needed.
13. **End every answer with how to check it works:** what to run, what to tap, and what I should see.
