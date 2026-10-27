import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, radius, space, type } from '@/theme'

/** A group of rows on one raised card, separated by lines. */
export function ChoiceList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>
}

/**
 * One row to choose: a title, an optional second line, and a check when selected. `role` is
 * `radio` for one-of-many picks and `button` for rows that go on to the next step.
 */
export function ChoiceRow({
  title,
  subtitle,
  selected = false,
  role = 'radio',
  onPress,
  last = false,
}: {
  title: string
  subtitle?: string
  selected?: boolean
  role?: 'radio' | 'button'
  onPress: () => void
  last?: boolean
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.separator,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? <Text style={styles.check}>{'✓'}</Text> : null}
      {role === 'button' && !selected ? <Text style={styles.chevron}>{'›'}</Text> : null}
    </Pressable>
  )
}

/** A small selectable chip: "Year 4", "1.1". */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  separator: { borderBottomWidth: 1, borderBottomColor: color.line },
  selected: { backgroundColor: color.sunken },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  title: { ...type.body, color: color.ink },
  subtitle: { ...type.caption, color: color.inkMuted },
  check: { ...type.subtitle, color: color.accent },
  chevron: { ...type.heading, color: color.inkMuted },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  chipSelected: { borderColor: color.accent, backgroundColor: color.sunken },
  chipLabel: { ...type.label, color: color.inkSoft },
  chipLabelSelected: { color: color.accent },
})
