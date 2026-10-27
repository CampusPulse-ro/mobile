import { useRouter, type Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { SITE_URL } from '@/campusVirtual/redirect'
import { openLink } from '@/components/openLink'
import { color, radius, space, type } from '@/theme'

import type { Outcome } from './text'

/** The assignment's own page on Campus Virtual, in the in-app browser. */
export function openInCampusVirtual(cmid: number) {
  const link = `${SITE_URL}/mod/assign/view.php?id=${cmid}`
  openLink(link)
}

/** Back, then the screen's title (and a second line). `fallback` when there's nothing to go back to. */
export function BackHeader({
  title,
  subtitle,
  large = false,
  fallback,
}: {
  title: string
  subtitle?: string
  large?: boolean
  fallback: Href
}) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <View style={styles.titleRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('assignments.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>{'‹'}</Text>
      </Pressable>
      <View style={styles.titleText}>
        <Text accessibilityRole="header" style={large ? styles.titleLarge : styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

/**
 * The shared `Button`'s look, plus `disabled` (greyed, not pressable): a write button stays
 * visible while it can't be used, with the reason next to it.
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  busy?: boolean
  disabled?: boolean
}) {
  const off = busy || disabled
  const greyed = disabled && !busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        greyed && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {busy ? <ActivityIndicator color={color.ink} /> : null}
      <Text
        style={[
          styles.buttonLabel,
          variant === 'secondary' && styles.buttonLabelSecondary,
          greyed && styles.buttonLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** What happened after a write: green when it worked, amber when it didn't (or may not have). */
export function OutcomeNote({ outcome }: { outcome: Outcome }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.outcome, outcome.ok ? styles.outcomeOk : styles.outcomeFailed]}
    >
      <Text style={[styles.outcomeText, outcome.ok ? styles.ok : styles.failed]}>
        {outcome.text}
      </Text>
    </View>
  )
}

/** The assignment's submission statement, which the student turns on to accept it. */
export function StatementSwitch({
  statement,
  value,
  onChange,
  disabled,
}: {
  statement: string
  value: boolean
  onChange: (value: boolean) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={`${t('assignments.statement.label')}: ${statement}`}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.statement}
    >
      <View style={styles.statementText}>
        <Text style={styles.statementLabel}>{t('assignments.statement.label')}</Text>
        <Text style={styles.statementBody}>{statement}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: color.line, true: color.accent }}
        thumbColor={color.ink}
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -space.sm },
  backText: { ...type.title, color: color.ink, paddingLeft: space.sm },
  pressed: { opacity: 0.6 },
  titleText: { flex: 1 },
  title: { ...type.heading, color: color.ink },
  titleLarge: { ...type.title, color: color.ink },
  subtitle: { ...type.bodySmall, color: color.inkSoft },
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
  buttonDisabled: { backgroundColor: color.sunken, borderColor: color.line },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: color.ink, fontSize: 15, fontWeight: '600' },
  buttonLabelSecondary: { color: color.inkSoft },
  buttonLabelDisabled: { color: color.inkMuted },
  outcome: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: color.raised,
  },
  outcomeOk: { borderColor: color.success },
  outcomeFailed: { borderColor: color.warn },
  outcomeText: { ...type.bodySmall },
  ok: { color: color.success },
  failed: { color: color.warn },
  statement: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunken,
  },
  statementText: { flex: 1, gap: space.xs },
  statementLabel: { ...type.caption, color: color.inkMuted },
  statementBody: { ...type.bodySmall, color: color.ink },
})
