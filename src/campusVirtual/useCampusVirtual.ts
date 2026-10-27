import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import {
  CampusVirtualError,
  CampusVirtualExpiredError,
  connect as connectAccount,
  disconnect as disconnectAccount,
  getSiteInfo,
  type SiteInfo,
} from './index'

export type CampusVirtualState =
  | { status: 'loading' }
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; fullname: string }
  | { status: 'expired' }
  | { status: 'error'; problem: 'unreachable' | 'refused' }
  | { status: 'error'; problem: 'rejected'; code: string }

function fromInfo(info: SiteInfo | null): CampusVirtualState {
  return info ? { status: 'connected', fullname: info.fullname } : { status: 'disconnected' }
}

function fromError(error: unknown): CampusVirtualState {
  if (error instanceof CampusVirtualExpiredError) return { status: 'expired' }
  if (error instanceof CampusVirtualError && error.kind === 'rejected') {
    return { status: 'error', problem: 'rejected', code: error.code }
  }
  return { status: 'error', problem: 'unreachable' }
}

/** The Campus Virtual connection as a screen needs it: loading, error, empty and data. */
export function useCampusVirtual() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<CampusVirtualState>({ status: 'loading' })
  // Deadlines and completion belong to the account: drop them when it changes.
  const forgetData = useCallback(
    () => void queryClient.resetQueries({ queryKey: ['campusVirtual'] }),
    [queryClient],
  )

  // The stored connection, read once when the screen mounts (the state starts as 'loading').
  useEffect(() => {
    let cancelled = false
    getSiteInfo().then(
      (info) => {
        if (!cancelled) setState(fromInfo(info))
      },
      (error: unknown) => {
        if (!cancelled) setState(fromError(error))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      setState(fromInfo(await getSiteInfo()))
    } catch (error) {
      setState(fromError(error))
    }
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void reload()
  }, [reload])

  const connect = useCallback(async () => {
    setState({ status: 'connecting' })
    try {
      const outcome = await connectAccount()
      if (outcome.kind === 'connected') {
        setState(fromInfo(outcome.info))
        forgetData()
      } else if (outcome.kind === 'refused') setState({ status: 'error', problem: 'refused' })
      else await reload() // cancelled: show whatever is stored (maybe still connected)
    } catch (error) {
      setState(fromError(error))
    }
  }, [reload, forgetData])

  const disconnect = useCallback(async () => {
    await disconnectAccount()
    setState({ status: 'disconnected' })
    forgetData()
  }, [forgetData])

  return { state, connect, disconnect, retry }
}
