import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Button, Screen, Title } from '@/components/ui'
import {
  matchesSearch,
  roomSections,
  roomStatus,
  RoomRow,
  sortRooms,
  useRooms,
  useRoomTimetables,
  type RoomStatus,
} from '@/rooms'
import { color, radius, space, type } from '@/theme'
import { campusToday, useNow } from '@/timetable'

/** How many rooms "Free now" checks at most: one request each. */
const FREE_CHECK_LIMIT = 20

/**
 * Every room, by building, with a search. A room's status shows once its day is known (opened
 * before, or checked by "Free now"); the list itself sends no request per room.
 */
export default function RoomsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const now = useNow()
  const today = campusToday(now)
  const rooms = useRooms()
  const [query, setQuery] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const matching = sortRooms(rooms.data ?? []).filter((room) => matchesSearch(room, query))
  const days = useRoomTimetables(
    matching.map((room) => room.code),
    today,
    freeOnly ? FREE_CHECK_LIMIT : 0,
  )
  const statuses = new Map<string, RoomStatus>()
  matching.forEach((room, index) => {
    const day = days[index]?.data
    if (day) statuses.set(room.code, roomStatus(day.occurrences, today, now))
  })

  const checked = matching.slice(0, FREE_CHECK_LIMIT)
  const checkedDays = days.slice(0, FREE_CHECK_LIMIT)
  const checking = freeOnly && checkedDays.some((day) => day.isPending)
  const failed = freeOnly ? checkedDays.filter((day) => day.isError && !day.data) : []
  const shown = freeOnly
    ? checked.filter((room) => statuses.get(room.code)?.kind === 'free')
    : matching

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([rooms.refetch(), ...(freeOnly ? checkedDays.map((d) => d.refetch()) : [])])
    setRefreshing(false)
  }

  let body
  if (rooms.isPending) {
    body = <LoadingState />
  } else if (rooms.isError && !rooms.data) {
    body = <ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} />
  } else if (rooms.data.length === 0) {
    body = <EmptyState title={t('rooms.noRooms')} about={t('rooms.noRoomsAbout')} />
  } else if (matching.length === 0) {
    body = <EmptyState title={t('rooms.noMatch', { query: query.trim() })} />
  } else if (shown.length === 0) {
    body = checking ? <LoadingState /> : <EmptyState title={t('rooms.noFreeRooms')} />
  } else {
    body = (
      <SectionList
        sections={roomSections(shown, t('rooms.noBuilding'))}
        keyExtractor={(room) => room.code}
        renderItem={({ item }) => (
          <RoomRow
            room={item}
            status={statuses.get(item.code) ?? null}
            onPress={() => router.push({ pathname: '/room/[code]', params: { code: item.code } })}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.section}>
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={color.inkMuted}
            colors={[color.accent]}
            progressBackgroundColor={color.raised}
          />
        }
      />
    )
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Title>{t('rooms.title')}</Title>
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('rooms.search')}
            placeholderTextColor={color.inkMuted}
            accessibilityLabel={t('rooms.searchLabel')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('rooms.clearSearch')}
              onPress={() => setQuery('')}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>{'×'}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>{t('rooms.freeNowFilter')}</Text>
          <Switch
            value={freeOnly}
            onValueChange={setFreeOnly}
            accessibilityLabel={t('rooms.freeNowFilter')}
            trackColor={{ false: color.line, true: color.accent }}
            thumbColor={color.ink}
          />
        </View>
        {freeOnly && matching.length > FREE_CHECK_LIMIT ? (
          <Text style={styles.note}>{t('rooms.capped', { n: FREE_CHECK_LIMIT })}</Text>
        ) : null}
        {checking && shown.length > 0 ? (
          <Text style={styles.note}>{t('rooms.checking')}</Text>
        ) : null}
        {failed.length > 0 ? (
          <View style={styles.failed}>
            <Text style={styles.warn}>{t('rooms.checkFailed', { n: failed.length })}</Text>
            <Button
              label={t('api.retry')}
              variant="secondary"
              onPress={() => failed.forEach((day) => void day.refetch())}
            />
          </View>
        ) : null}
        {rooms.isError && rooms.data ? (
          <Text style={styles.warn}>{t('states.refreshFailed')}</Text>
        ) : null}
      </View>
      <View style={styles.body}>{body}</View>
    </Screen>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
  },
  search: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: space.lg,
    paddingRight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
    color: color.ink,
    ...type.body,
  },
  clear: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { ...type.heading, color: color.inkMuted },
  pressed: { opacity: 0.6 },
  toggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  toggleLabel: { ...type.label, color: color.ink, flex: 1 },
  note: { ...type.caption, color: color.inkMuted },
  failed: { gap: space.sm },
  warn: { ...type.caption, color: color.warn },
  body: { flex: 1 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  section: {
    ...type.label,
    color: color.inkSoft,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  separator: { height: space.sm },
})
