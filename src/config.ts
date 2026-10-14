/**
 * App configuration that differs per build.
 *
 * `EXPO_PUBLIC_API_BASE` is set per EAS build profile in `eas.json`: the `development` and
 * `preview` builds talk to the stage API, `production` to prod. Locally (Expo Go or the dev
 * server) it is unset, so the app talks to stage. Never write an API URL anywhere else.
 */
const STAGE_API = 'https://campuspulse-api-stage.thorsp.net'

export const apiBase: string = (process.env.EXPO_PUBLIC_API_BASE ?? STAGE_API).replace(/\/+$/, '')
