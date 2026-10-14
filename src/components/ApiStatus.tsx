import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/client'
import { useApiReadiness } from '@/api/health'
import { color, space } from '@/theme'

/** One line saying whether the CampusPulse API answers: loading, error (with retry) or data. */
export function ApiStatus() {
  const { t } = useTranslation()
  const readiness = useApiReadiness()

  if (readiness.isPending) {
    return <Text style={styles.line}>{t('api.checking')}</Text>
  }

  if (readiness.isError) {
    // An ApiError means the server answered: 503 is "up, but no database"; any other status is a
    // server-side error. Anything else (no connection, DNS, a timeout) never reached the server.
    const error = readiness.error
    const message =
      error instanceof ApiError
        ? error.status === 503
          ? t('api.notReady')
          : t('api.serverError')
        : t('api.unreachable')
    return (
      <View style={styles.row}>
        <Text style={[styles.line, styles.problem]}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void readiness.refetch()}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{t('api.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  return <Text style={styles.line}>{t('api.ready')}</Text>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
  line: { color: color.inkMuted, fontSize: 14 },
  problem: { color: color.warn },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: color.accent, fontSize: 14, fontWeight: '600' },
})
