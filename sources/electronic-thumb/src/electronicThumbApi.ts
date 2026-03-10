/**
 * Public API of the Electronic Thumb widget: window.ElectronicThumb
 * State (read), config (callbacks + anchorSelector, labels), refresh() method.
 */

export interface ElectronicThumbState {
  connected: boolean
  address: string | null
  chainId: number | null
  chainIdHex: string | null
  networkName: string | null
  environment: 'mainnet' | 'testnet' | 'creative' | null
  nativeCurrency: { name: string; symbol: string; decimals: number; baseUnit?: string | null } | null
  /** Native token balance, human-readable (e.g. "1.234"). Null when disconnected or while loading. */
  nativeBalance: string | null
  /** Native token balance in base unit (smallest unit), as string for precision. Null when disconnected or while loading. */
  nativeBalanceBase: string | null
  provider: unknown
}

/** Snapshot without circular refs (provider as placeholder) for JSON.stringify and callbacks. */
export interface ElectronicThumbStateSerializable {
  connected: boolean
  address: string | null
  chainId: number | null
  chainIdHex: string | null
  networkName: string | null
  environment: 'mainnet' | 'testnet' | 'creative' | null
  nativeCurrency: { name: string; symbol: string; decimals: number; baseUnit?: string | null } | null
  nativeBalance: string | null
  nativeBalanceBase: string | null
  provider: boolean | null
}

export function getSerializableSnapshot(state: ElectronicThumbState): ElectronicThumbStateSerializable {
  return {
    connected: state.connected,
    address: state.address,
    chainId: state.chainId,
    chainIdHex: state.chainIdHex,
    networkName: state.networkName,
    environment: state.environment,
    nativeCurrency: state.nativeCurrency,
    nativeBalance: state.nativeBalance,
    nativeBalanceBase: state.nativeBalanceBase,
    provider: state.provider != null ? true : null,
  }
}

export interface ElectronicThumbCallbacks {
  onStateUpdate?: (state: ElectronicThumbStateSerializable) => void
  onConnect?: (state: ElectronicThumbStateSerializable) => void
  onDisconnect?: (state: ElectronicThumbStateSerializable) => void
  onChainChanged?: (state: ElectronicThumbStateSerializable) => void
  onAccountsChanged?: (state: ElectronicThumbStateSerializable) => void
}

export interface ElectronicThumbConfig {
  /** CSS selector for the element the panel anchors to (e.g. "#my-menu", ".wallet-anchor"). If unset, panel anchors to the widget container (div with electronic-thumb-widget attribute). */
  anchorSelector?: string
  /** Button label when no wallet is connected (default "Connect"). */
  connectButtonLabel?: string
  /** Button label while connecting (default "Connecting…"). */
  connectButtonLoadingLabel?: string
  /** URL of an image/icon shown to the left of the Connect button text (optional). */
  connectButtonImage?: string
}

export type ElectronicThumbGlobal = ElectronicThumbState &
  ElectronicThumbCallbacks &
  ElectronicThumbConfig & {
    refresh: () => void
  }

declare global {
  interface Window {
    ElectronicThumb?: ElectronicThumbGlobal
  }
}

const DEFAULT_STATE: ElectronicThumbState = {
  connected: false,
  address: null,
  chainId: null,
  chainIdHex: null,
  networkName: null,
  environment: null,
  nativeCurrency: null,
  nativeBalance: null,
  nativeBalanceBase: null,
  provider: undefined as unknown,
}

let refreshImpl: (() => void) | null = null
let mountedContainer: HTMLElement | null = null

export function setRefreshImpl(fn: (() => void) | null): void {
  refreshImpl = fn
}

/** Container where the app was mounted; used as default anchor when anchorSelector is not set. */
export function getElectronicThumbContainerForAnchor(): HTMLElement | null {
  return mountedContainer
}

/**
 * Creates the initial state object and assigns it to window.ElectronicThumb.
 * Reads config (callbacks, anchorSelector, labels) that the implementer may have set before loading the script.
 * Idempotent: if already initialized (has refresh), does not overwrite.
 */
export function initElectronicThumb(): ElectronicThumbState {
  const pre = window.ElectronicThumb as ElectronicThumbGlobal | undefined
  if (typeof pre?.refresh === 'function') {
    return pre as unknown as ElectronicThumbState
  }
  const callbacks: ElectronicThumbCallbacks = {
    onStateUpdate: pre?.onStateUpdate,
    onConnect: pre?.onConnect,
    onDisconnect: pre?.onDisconnect,
    onChainChanged: pre?.onChainChanged,
    onAccountsChanged: pre?.onAccountsChanged,
  }
  const config: ElectronicThumbConfig = {
    anchorSelector: pre?.anchorSelector,
    connectButtonLabel: pre?.connectButtonLabel,
    connectButtonLoadingLabel: pre?.connectButtonLoadingLabel,
    connectButtonImage: pre?.connectButtonImage,
  }

  const state: ElectronicThumbState = { ...DEFAULT_STATE }

  const globalObj: ElectronicThumbGlobal = {
    ...state,
    ...callbacks,
    ...config,
    refresh() {
      if (refreshImpl) refreshImpl()
    },
  }

  // Keep the same object so sync updates (assign) do not lose refresh
  Object.assign(globalObj, state)
  window.ElectronicThumb = globalObj
  return state
}

/**
 * Updates state on window.ElectronicThumb and returns the current snapshot.
 * Sync must assign only state properties, not callbacks or refresh.
 */
export function updateElectronicThumbState(
  state: ElectronicThumbState,
): ElectronicThumbState {
  const g = window.ElectronicThumb
  if (!g) return state
  g.connected = state.connected
  g.address = state.address
  g.chainId = state.chainId
  g.chainIdHex = state.chainIdHex
  g.networkName = state.networkName
  g.environment = state.environment
  g.nativeCurrency = state.nativeCurrency
  g.nativeBalance = state.nativeBalance
  g.nativeBalanceBase = state.nativeBalanceBase
  g.provider = state.provider
  return { ...state }
}

/**
 * Returns the container to mount the app: the div with electronic-thumb-widget attribute (only documented form).
 * If none, falls back to #root for local development.
 */
export function getElectronicThumbContainer(): HTMLElement | null {
  const byAttr = document.querySelector<HTMLElement>('[electronic-thumb-widget]')
  if (byAttr) {
    mountedContainer = byAttr
    return byAttr
  }
  const root = document.getElementById('root')
  if (root) {
    mountedContainer = root
    return root
  }
  mountedContainer = null
  return null
}
