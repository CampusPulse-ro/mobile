/**
 * CampusPulse design tokens. Dark only: there is no light theme.
 *
 * The web app uses the same palette, so the two clients read as one product.
 */
export const color = {
  page: '#0f1115',
  raised: '#171a21',
  sunken: '#1f232c',
  ink: '#e8eaee',
  inkSoft: '#c3c8d1',
  inkMuted: '#8b93a1',
  line: '#262a33',
  brand: '#4f8cff',
  danger: '#f87171',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const
