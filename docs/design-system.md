# CampusPulse design system (mobile)

The whole system (source of truth, token flow, naming rules and the component inventory) is
described once, in the web repo: [web/docs/design-system.md](https://github.com/CampusPulse-ro/web/blob/main/docs/design-system.md).
This page is only what's different here.

## Tokens in this app

- **Use them through `@/theme`:** `color.page`, `color.inkMuted`, `space.md`, `radius.pill`, and the
  type scale `type.title` … `type.caption` as text styles (`style={[type.bodySmall, { color:
color.inkMuted }]}`; no font family, the platform font stays). Text on an accent or danger fill is
  `color.onAccent`. Never a hex color or a magic number in a screen.
- They're generated, never written by hand:
  - `src/design/tokens.json` is a byte-for-byte copy of web's `design/tokens.json`, the one source;
  - `src/design/tokens.ts` is generated from it, and `src/theme.ts` re-exports it.
- **To change a token:** change web's `design/tokens.json` first (its own PR). Once that's merged, run
  `bun run design:tokens` here: it downloads the file from web's `main` and regenerates. Commit both
  files in one PR.
- CI ("Design tokens match") regenerates from the committed copy without the network and fails if
  `tokens.ts` differs. It does **not** compare with web: a token changed there reaches this app only
  when someone runs the script here.
- Names: kebab-case in the JSON (`ink-soft`), camelCase here (`inkSoft`). Spacing and radius are in
  density-independent pixels.

## Components

The design is in Penpot: [CampusPulse Design System](https://design.penpot.app/#/workspace?team-id=cd444aaf-0d8c-801b-8008-cea5af48ec20&file-id=ce180602-f36b-8035-8008-cea5c29ed940)
(team CampusPulse; Sebastian invites). Its Components page draws every component at mobile size
(390 wide) first. Same names, variants and props as in Penpot and on web: a Penpot variant property
is the prop, with the same name and values (the inventory in web's doc). A component used by more
than one screen lives in `src/components/`; today `ui.tsx` has `Screen`, `Title`, `Muted` and
`Placeholder` (the future `EmptyState`).
