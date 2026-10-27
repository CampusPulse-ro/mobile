import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { queryClient } from '@/api/queryClient'
import { loadSession, signOut, useSession } from '@/auth'
import { loadSavedLanguage } from '@/i18n'
import { useSettings } from '@/timetable'
import { color } from '@/theme'

void SplashScreen.preventAutoHideAsync()

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.page,
    card: color.raised,
    text: color.ink,
    border: color.line,
    primary: color.accent,
  },
}

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // A storage call that never answers must not keep the splash up forever.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500))
    void Promise.race([loadSavedLanguage(), timeout]).finally(() => setReady(true))
    void loadSession()
  }, [])

  // Keep the splash up until the saved language is applied: rendering earlier would
  // flash English at someone who picked Romanian.
  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Routes />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

/**
 * Who sees what: sign-in when signed out; the timetable setup until the student has a group; then
 * the tabs. The splash stays up until that is known.
 */
function Routes() {
  const { status } = useSession()
  const signedIn = status === 'signedIn'
  const settings = useSettings({ enabled: signedIn })

  // No account behind a valid token: deleted, maybe from another device. Sign out and say why.
  const accountGone = settings.error instanceof ApiError && settings.error.status === 404
  useEffect(() => {
    if (accountGone) void signOut('accountGone')
  }, [accountGone])

  // Signed out: forget every cached response of the previous student.
  useEffect(() => {
    if (status === 'signedOut') queryClient.clear()
  }, [status])

  // A settings request that failed (offline) still opens the tabs, which show their own errors.
  const needsSetup = signedIn && settings.isSuccess && !settings.data.studyGroup
  const phase =
    status === 'loading' || (signedIn && settings.isPending)
      ? 'loading'
      : !signedIn
        ? 'signedOut'
        : needsSetup
          ? 'setup'
          : 'app'

  // The splash covers only the first answer; later loading (right after sign-in) keeps the
  // navigator mounted, so its state isn't thrown away.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (phase !== 'loading' && !started) {
      setStarted(true)
      void SplashScreen.hideAsync()
    }
  }, [phase, started])

  // Move to the screen the new phase belongs on: the guards alone leave a screen that just became
  // unavailable (sign-in, right after signing in) on the "unmatched route" page. The first
  // answer at launch keeps the URL the app opened with (Profile after a Campus Virtual link).
  const router = useRouter()
  const previous = useRef<string>('loading')
  useEffect(() => {
    if (phase === 'loading' || phase === previous.current) return
    const first = previous.current === 'loading' && !started
    previous.current = phase
    if (phase === 'signedOut') router.replace('/sign-in')
    else if (phase === 'setup') router.replace('/setup')
    else if (!first) router.replace('/')
  }, [phase, router, started])

  if (!started && phase === 'loading') return null

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.page } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsSetup}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      {/* Open whenever signed in, so "Pick my group again" can come back to it. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
  )
}
