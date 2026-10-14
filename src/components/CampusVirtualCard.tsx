import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useCampusVirtual } from '@/campusVirtual/useCampusVirtual'
import { Button, Heading, Muted } from '@/components/ui'
import { color, radius, space } from '@/theme'

/** Profile's Campus Virtual section: connect, see who is connected, reconnect, disconnect. */
export function CampusVirtualCard() {
  const { t } = useTranslation()
  const { state, connect, disconnect, retry } = useCampusVirtual()

  return (
    <View style={styles.card}>
      <Heading>{t('campusVirtual.title')}</Heading>

      {state.status === 'loading' ? (
        <View style={styles.row}>
          <ActivityIndicator color={color.inkMuted} />
          <Muted>{t('campusVirtual.loading')}</Muted>
        </View>
      ) : null}

      {state.status === 'disconnected' || state.status === 'connecting' ? (
        <>
          <Muted>{t('campusVirtual.about')}</Muted>
          <Button
            label={
              state.status === 'connecting'
                ? t('campusVirtual.connecting')
                : t('campusVirtual.connect')
            }
            busy={state.status === 'connecting'}
            onPress={() => void connect()}
          />
        </>
      ) : null}

      {state.status === 'connected' ? (
        <>
          <Muted>
            {state.fullname
              ? t('campusVirtual.connectedAs', { name: state.fullname })
              : t('campusVirtual.connected')}
          </Muted>
          <Button
            label={t('campusVirtual.disconnect')}
            variant="secondary"
            onPress={() => void disconnect()}
          />
        </>
      ) : null}

      {state.status === 'expired' ? (
        <>
          <Muted>{t('campusVirtual.expired')}</Muted>
          <Button label={t('campusVirtual.reconnect')} onPress={() => void connect()} />
        </>
      ) : null}

      {state.status === 'error' ? (
        <>
          <Muted style={styles.problem}>
            {state.problem === 'refused'
              ? t('campusVirtual.errorRefused')
              : state.problem === 'rejected'
                ? t('campusVirtual.errorRejected', { code: state.code })
                : t('campusVirtual.errorUnreachable')}
          </Muted>
          <Button
            label={t('campusVirtual.retry')}
            onPress={() => void (state.problem === 'refused' ? connect() : retry())}
          />
          <Button
            label={t('campusVirtual.disconnect')}
            variant="secondary"
            onPress={() => void disconnect()}
          />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  problem: { color: color.warn },
})
