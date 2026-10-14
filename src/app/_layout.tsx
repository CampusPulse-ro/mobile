import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'

import { queryClient } from '@/api/queryClient'
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
  }, [])

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  // Keep the splash up until the saved language is applied: rendering earlier would
  // flash English at someone who picked Romanian.
  if (!ready) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.page } }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
