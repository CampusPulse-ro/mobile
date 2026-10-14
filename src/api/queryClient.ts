import { QueryClient } from '@tanstack/react-query'

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
