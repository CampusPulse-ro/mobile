import type { ReactNode } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { color, space } from '@/theme'

/** A full screen on the page colour, inset from the notch and the status bar. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  )
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>
}

/** A placeholder screen: the tab's title and one line saying what will live there. */
export function Placeholder({ title, about }: { title: string; about: string }) {
  return (
    <Screen>
      <View style={styles.header}>
        <Title>{title}</Title>
        <Muted>{about}</Muted>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xs },
  title: { color: color.ink, fontSize: 28, fontWeight: '700' },
  muted: { color: color.inkMuted, fontSize: 15 },
})
