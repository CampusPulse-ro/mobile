import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { color, radius, space } from '@/theme'

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

/**
 * A placeholder screen: the tab's title, one line saying what will live there, and
 * whatever already works on it (children) below.
 */
export function Placeholder({
  title,
  about,
  children,
}: {
  title: string
  about: string
  children?: ReactNode
}) {
  return (
    <Screen>
      <View style={styles.header}>
        <Title>{title}</Title>
        <Muted>{about}</Muted>
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </Screen>
  )
}

/** A section heading inside a screen. */
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  )
}

/**
 * A full-width button, at least 44 high. `primary` for the main action, `secondary` for the rest.
 * While `busy` it shows a spinner and can't be pressed.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  busy?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && styles.buttonPressed,
      ]}
    >
      {busy ? <ActivityIndicator color={color.ink} /> : null}
      <Text style={[styles.buttonLabel, variant === 'secondary' && styles.buttonLabelSecondary]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.xs },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, gap: space.md },
  title: { color: color.ink, fontSize: 28, fontWeight: '700' },
  muted: { color: color.inkMuted, fontSize: 15 },
  heading: { color: color.ink, fontSize: 18, fontWeight: '600' },
  button: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  buttonSecondary: { backgroundColor: color.raised, borderColor: color.line },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: color.ink, fontSize: 15, fontWeight: '600' },
  buttonLabelSecondary: { color: color.inkSoft },
})
