import { focusManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

/** One cache for the whole app; provided in the root layout. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry for a flaky phone network, then show the error state with a way to try again.
      retry: 1,
      staleTime: 30_000,
    },
  },
})

// React Native has no window focus: tell TanStack Query when the app comes back to the
// foreground, so stale data refreshes on resume. Set up once, with the client.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'))
}
