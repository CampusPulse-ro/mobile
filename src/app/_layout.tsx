import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { color } from '@/theme'

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
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.page } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  )
}
