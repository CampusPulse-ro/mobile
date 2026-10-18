/**
 * Campus Virtual hands the app its token at `campuspulse://token=…` (src/campusVirtual). That URL
 * is a credential, so expo-router must never route to it: its "unmatched route" screen would
 * print it (and Android keeps a screenshot of it in Recents).
 *
 * While a sign-in tab is open, expo-web-browser receives the URL itself, so the router ignores it
 * (null). If it arrives on a cold start (the app was killed in the meantime) the sign-in attempt
 * is gone, so the token is dropped and the app opens on Profile, where Connect is.
 */
const TOKEN_LINK = /^campuspulse:\/\/\/?token=/i

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}): string | null {
  try {
    if (TOKEN_LINK.test(path)) return initial ? '/profile' : null
    return path
  } catch {
    return initial ? '/' : null
  }
}
