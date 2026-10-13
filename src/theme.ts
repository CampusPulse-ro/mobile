/**
 * CampusPulse design tokens. One dark palette for now; a light theme would be a second set
 * with the same names.
 *
 * Same names and values as the web app's `@theme` tokens (web/src/index.css), so the two
 * clients read as one product. Change both together.
 */
export const color = {
  page: '#0f1115',
  raised: '#181b21',
  sunken: '#0b0d10',
  ink: '#e6e8eb',
  inkSoft: '#c2c8cf',
  inkMuted: '#9aa3ad',
  line: '#262a31',
  lineStrong: '#3a404a',
  accent: '#4f8cff',
  warn: '#f2b84b',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const
