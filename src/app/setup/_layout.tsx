import { Stack } from 'expo-router'

import { color } from '@/theme'

/** Timetable setup: programme (index) → year and group → optional subjects. */
export default function SetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.page } }} />
  )
}
