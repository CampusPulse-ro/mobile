import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'

/** Whether the API and its database answer (`GET /health/ready`). */
export function useApiReadiness() {
  return useQuery({
    queryKey: ['health', 'ready'],
    queryFn: async ({ signal }) => unwrap(await api.GET('/health/ready', { signal })),
  })
}
