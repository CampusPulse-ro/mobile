import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * app.json plus what it can't hold: Firebase's `google-services.json` (Android push) is never
 * committed (the repo is public). On EAS it is the file environment variable `GOOGLE_SERVICES_JSON`,
 * which holds the path of the written file; for a local build, point the variable at your copy.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
})
