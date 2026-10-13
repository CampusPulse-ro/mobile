# Contributing

How we work in this repo. Short on purpose: if something here is unclear, ask Sebastian.

## Workflow

Work is tracked in **issues**. Every PR starts from one: the issue says what to build and why, and
what "done" means (its acceptance criteria). If you want to do something that has no issue, open
one first (the **Task** or **Bug** template) or ask Sebastian to.

All issues of the three repos are on the [CampusPulse board](https://github.com/orgs/CampusPulse-ro/projects/1)
(columns Todo → In Progress → In Review → Done). New issues land there in Todo by themselves.

1. Pick or get assigned an issue. Read it fully; ask in the issue if anything is unclear. Move
   its card to **In Progress**.
2. Start from an up-to-date `main`:
   ```bash
   git switch main
   git pull
   ```
3. Make a branch for that issue: `git switch -c <type>/<issue-number>-<short-name>`.
   Types: `feat` (new thing), `fix` (bug), `docs`, `chore` (tooling, cleanup). Example for issue
   #12: `feat/12-timetable-list`.
4. Commit in small steps. Messages say what the commit does, in the imperative:
   "Add the timetable list", not "changes" or "fixed stuff".
5. Push and open a pull request (PR) into `main`. The template asks for:
   - `Closes #<issue>` on the first line, so merging closes the issue
   - **What** changed
   - **Why**
   - **How I tested it**: which device, what you tapped, and a screenshot for anything visible
6. The card moves to **In Review** by itself once the PR says `Closes #<n>`, and to **Done**
   when it's merged. CI has to be green (lint, typecheck, bundle), and a PR needs one approval: Sebastian
   reviews.
7. Merging is **squash only**: the whole PR becomes one commit on `main`, titled with the PR
   title. So write a good PR title; individual commit messages matter less.
8. After the merge: `git switch main && git pull`, then delete your local branch
   (`git branch -d <name>`). GitHub deletes the remote one.

One issue = one PR = one thing. If it grows past roughly 300 changed lines, split the issue.

## Where things go

| Path              | What goes there                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `src/app/`        | Screens. expo-router turns each file into a route; `(tabs)/` holds the tab screens                       |
| `src/components/` | Pieces used by more than one screen. `ui.tsx` has the basics (`Screen`, `Title`, `Muted`, `Placeholder`) |
| `src/theme.ts`    | Colors, spacing and corner radius. The only place colors are defined                                     |
| `modules/`        | Native code (Kotlin/Swift). Sebastian's area                                                             |

A new top-level folder (for example `src/api/` or `src/hooks/`): ask first, so the structure stays
the same for everyone.

## Code standards

- **TypeScript stays strict.** No `any`, no `@ts-ignore`, no turning off lint rules. If the types
  fight you, that's a question to ask, not a rule to switch off.
- **Styling uses the tokens in `src/theme.ts`** (`color.page`, `space.md`, `radius.lg`...), never a
  hex color written in a screen. That keeps a later light theme (or any palette change) a
  one-file change.
- **Every screen that loads data shows four states:** loading, error (with a way to retry), empty
  ("no classes today"), and the data.
- **Imports use the `@/` alias:** `import { Screen } from '@/components/ui'`.
- **Formatting is Prettier's job:** run `bun run format` before committing; CI fails on unformatted
  code. Don't hand-tune spacing or line breaks.
- **No new package without asking.** When one is agreed, install it with `bunx expo install <name>`,
  not `bun add`: Expo picks the version that matches our SDK.
- **The backend is reached only through the generated API client** (being set up). Never a URL typed
  into a screen.
- **No secrets in the code or the repo:** no passwords, tokens or `.env` files.
- **Touch targets** are at least 44×44, and an icon-only button has an `accessibilityLabel`.

## Before you open a PR

```bash
bun run format
bun run lint
bun run typecheck
```

…and you ran it on a phone, looked at every screen you touched, and checked the loading, error and
empty states.

## Using AI

See [`docs/ai-development.md`](docs/ai-development.md).
