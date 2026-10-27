import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'

import { api, ApiError, unwrap } from '@/api/client'
import { queryClient } from '@/api/queryClient'
import { loadSession, signOut, useSession } from '@/auth'
import { loadSavedLanguage } from '@/i18n'
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
  const settings = useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => unwrap(await api.GET('/me/settings')),
    enabled: signedIn,
  })

  // No account behind a valid token: deleted, maybe from another device. Sign out and say why.
  const accountGone = settings.error instanceof ApiError && settings.error.status === 404
  useEffect(() => {
    if (accountGone) void signOut('accountGone')
  }, [accountGone])

  // Signed out: forget every cached response of the previous student.
  useEffect(() => {
    if (status === 'signedOut') queryClient.clear()
  }, [status])

  const known = status === 'signedOut' || (signedIn && !settings.isPending)
  useEffect(() => {
    if (known) void SplashScreen.hideAsync()
  }, [known])
  if (!known) return null

  // A settings request that failed (offline) still opens the tabs, which show their own errors.
  const needsSetup = signedIn && settings.isSuccess && !settings.data.studyGroup

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.page } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={needsSetup}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsSetup}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  )
}
