/**
 * Syncs wagmi state to window.ElectronicThumb and triggers callbacks.
 * Registers refresh() so it re-syncs and calls onStateUpdate.
 */
import { useEffect, useRef, useState } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { chainCustomByChainId } from './wagmiConfig'
import {
  getSerializableSnapshot,
  setRefreshImpl,
  updateElectronicThumbState,
  type ElectronicThumbState,
} from './electronicThumbApi'

function buildState(
  connected: boolean,
  address: string | null,
  chainId: number | null,
  chainName: string | null,
  nativeCurrencyFromChain: { name: string; symbol: string; decimals: number } | null,
  nativeBalance: string | null,
  nativeBalanceBase: string | null,
  provider: unknown,
): ElectronicThumbState {
  const custom = chainId != null ? chainCustomByChainId[chainId] : null
  const nativeCurrency =
    nativeCurrencyFromChain != null
      ? {
          ...nativeCurrencyFromChain,
          baseUnit: custom?.baseUnit ?? null,
        }
      : null
  return {
    connected,
    address,
    chainId,
    chainIdHex: chainId != null ? `0x${chainId.toString(16)}` : null,
    networkName: chainName,
    environment: custom?.environment ?? null,
    nativeCurrency,
    nativeBalance,
    nativeBalanceBase,
    provider,
  }
}

export function ElectronicThumbSync() {
  const { address, isConnected, chain, connector } = useAccount()
  const { data: balanceData } = useBalance({ address: address ?? undefined })
  const [provider, setProvider] = useState<unknown>(undefined)
  const prevRef = useRef<ElectronicThumbState | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      if (!connector) {
        setProvider(undefined)
        return
      }
      const getProvider = connector.getProvider
      if (typeof getProvider !== 'function') {
        setProvider(undefined)
        return
      }
      getProvider
        .call(connector)
        .then((p: unknown) => { if (!cancelled) setProvider(p) })
        .catch(() => { if (!cancelled) setProvider(undefined) })
    } catch (_) {
      setProvider(undefined)
    }
    return () => { cancelled = true }
  }, [connector])

  const state = buildState(
    isConnected,
    address ?? null,
    chain?.id ?? null,
    chain?.name ?? null,
    chain?.nativeCurrency ?? null,
    balanceData?.formatted ?? null,
    balanceData?.value != null ? String(balanceData.value) : null,
    provider,
  )

  useEffect(() => {
    const g = window.ElectronicThumb
    if (!g) return

    const snapshot = updateElectronicThumbState(state)
    const serializable = getSerializableSnapshot(snapshot)
    const prev = prevRef.current

    function safeCall(
      fn: ((s: ReturnType<typeof getSerializableSnapshot>) => void) | undefined,
      arg: ReturnType<typeof getSerializableSnapshot>,
    ) {
      if (typeof fn !== 'function') return
      try {
        fn(arg)
      } catch (err) {
        console.error('[ElectronicThumb] callback error:', err)
      }
    }

    safeCall(g.onStateUpdate, serializable)

    if (prev) {
      if (!prev.connected && snapshot.connected) safeCall(g.onConnect, serializable)
      if (prev.connected && !snapshot.connected) safeCall(g.onDisconnect, serializable)
      if (prev.chainId !== snapshot.chainId) safeCall(g.onChainChanged, serializable)
      if (prev.address !== snapshot.address) safeCall(g.onAccountsChanged, serializable)
    } else if (snapshot.connected) {
      safeCall(g.onConnect, serializable)
    }

    prevRef.current = snapshot
  }, [state.connected, state.address, state.chainId, state.chainIdHex, state.networkName, state.environment, state.nativeCurrency, state.nativeBalance, state.nativeBalanceBase, state.provider])

  useEffect(() => {
    function refresh() {
      const g = window.ElectronicThumb
      if (!g) return
      const snapshot: ElectronicThumbState = {
        connected: g.connected,
        address: g.address,
        chainId: g.chainId,
        chainIdHex: g.chainIdHex,
        networkName: g.networkName,
        environment: g.environment,
        nativeCurrency: g.nativeCurrency,
        nativeBalance: g.nativeBalance,
        nativeBalanceBase: g.nativeBalanceBase,
        provider: g.provider,
      }
      const serializable = getSerializableSnapshot(snapshot)
      if (typeof g.onStateUpdate === 'function') {
        try {
          g.onStateUpdate(serializable)
        } catch (err) {
          console.error('[ElectronicThumb] onStateUpdate error:', err)
        }
      }
    }
    setRefreshImpl(refresh)
    return () => setRefreshImpl(null)
  }, [])

  return null
}
