import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { focusManager, QueryClient, type Query } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import Constants from 'expo-constants'
import { AppState, Platform } from 'react-native'

/** How long a stored answer stays usable offline: a week covers a long weekend without signal. */
const OFFLINE_FOR_MS = 7 * 24 * 60 * 60_000

/** One cache for the whole app; provided in the root layout. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry for a flaky phone network, then show the error state with a way to try again.
      retry: 1,
      staleTime: 30_000,
      // Kept in memory as long as it's kept on disk, or the stored copy would be dropped early.
      gcTime: OFFLINE_FOR_MS,
    },
  },
})

// React Native has no window focus: tell TanStack Query when the app comes back to the
// foreground, so stale data refreshes on resume. Set up once, with the client.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'))
}

/**
 * The cache is also stored on the phone (AsyncStorage), so the last loaded timetable, rooms and
 * deadlines show with no connection, or on UPT Wi-Fi, whose firewall blocks our API. Only answers
 * the student could see anyway are stored, never a token. The stored copy expires after a week and
 * is dropped when the app version changes; signing out removes it (`forgetStoredCache`).
 */
const CACHE_SHAPE = 2
const STORED_ROOTS = new Set(['me', 'semester', 'timetable', 'rooms', 'campusVirtual'])

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'campuspulse.queryCache',
  throttleTime: 1000,
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: OFFLINE_FOR_MS,
  // Bump CACHE_SHAPE when a stored query's data changes shape, so an old copy is never read.
  buster: `${Constants.expoConfig?.version ?? ''}:${CACHE_SHAPE}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && STORED_ROOTS.has(String(query.queryKey[0])),
  },
}

/** Removes the stored copy of the cache (on sign-out, with `queryClient.clear()`). */
export async function forgetStoredCache(): Promise<void> {
  await persister.removeClient()
}
