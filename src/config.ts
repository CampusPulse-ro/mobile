/**
 * App configuration that differs per build.
 *
 * `EXPO_PUBLIC_API_BASE` is inlined into the JavaScript when it is bundled:
 * - EAS `preview` and `production` builds bundle their JS on EAS, with the variable from their
 *   profile in `eas.json` (stage and prod).
 * - A development build or Expo Go loads its JS from your `bun start`, so the value comes from
 *   that shell or a `.env.local` file. Unset there means stage.
 *
 * A release bundle made any other way (`expo run:android --variant release`, `expo export`, a
 * future `eas update`) must set the variable explicitly: falling back to stage there would ship
 * a production-looking app that talks to the wrong API, so it fails loudly instead.
 * Never write an API URL anywhere else.
 */
const STAGE_API = 'https://campuspulse-api-stage.thorsp.net'

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE || ''
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (__DEV__) return STAGE_API
  throw new Error(
    'EXPO_PUBLIC_API_BASE is not set for this release bundle. Build with an eas.json profile ' +
      'or set the variable explicitly.',
  )
}

export const apiBase: string = resolveApiBase()
