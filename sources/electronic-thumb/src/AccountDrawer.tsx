/**
 * Drawer — clone of Uniswap AccountDrawer: panel that opens on trigger click.
 * If window.ElectronicThumb.anchorSelector is set, the panel is positioned relative to that element.
 * Otherwise the panel anchors to the widget container (the div with the electronic-thumb-widget attribute).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getElectronicThumbContainerForAnchor } from './electronicThumbApi'
import { useAccount, useBalance, useConnect, useDisconnect, useConfig } from 'wagmi'
import { switchChain } from 'wagmi/actions'
import { useAccountDrawer } from './useAccountDrawer'
import { config, chainCustomByChainId } from './wagmiConfig'

const DEFAULT_ANCHOR_GAP = 8

/** Parses a CSS length value (px or rem) to a number in pixels. */
function parseLengthPx(value: string): number {
  const s = value.trim()
  if (!s) return 0
  const num = parseFloat(s)
  if (Number.isNaN(num)) return 0
  if (s.endsWith('rem')) {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    return num * rootFontSize
  }
  return num
}

function getAnchorStyle(): { top: number; right: number } | null {
  const g = window.ElectronicThumb
  const selector = g?.anchorSelector
  let anchorEl: HTMLElement | null = null
  if (selector && typeof selector === 'string') {
    const found = document.querySelector(selector)
    anchorEl = found && found instanceof HTMLElement ? found : null
  } else {
    anchorEl = getElectronicThumbContainerForAnchor()
  }
  if (!anchorEl) return null
  const rect = anchorEl.getBoundingClientRect()
  const container = getElectronicThumbContainerForAnchor()
  const styleEl = container || anchorEl
  const computed = getComputedStyle(styleEl)
  const gapStr = computed.getPropertyValue('--et-drawer-anchor-gap').trim()
  const gap = gapStr ? parseLengthPx(gapStr) || DEFAULT_ANCHOR_GAP : DEFAULT_ANCHOR_GAP
  const rightMarginStr = computed.getPropertyValue('--et-drawer-anchor-right-margin').trim()
  const rightMargin = rightMarginStr ? parseLengthPx(rightMarginStr) : 0
  return {
    top: rect.bottom + gap,
    right: window.innerWidth - rect.right + rightMargin,
  }
}

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format balance string to at most 4 decimal places; trims trailing zeros. */
function formatBalanceMaxDecimals(value: string, maxDecimals: number = 4): string {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return value
  const fixed = n.toFixed(maxDecimals)
  return fixed.replace(/\.?0+$/, '') || '0'
}

export function AccountDrawer() {
  const { address, isConnected, chain } = useAccount()
  const { data: balanceData } = useBalance({ address: address ?? undefined })
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isSwitchPending, setIsSwitchPending] = useState(false)
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const accountDrawer = useAccountDrawer()

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(
      () => {
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 1500)
      },
      () => {},
    )
  }

  const explorerUrl =
    address && chain?.blockExplorers?.default?.url
      ? `${chain.blockExplorers.default.url}/address/${address}`
      : null
  const chains = config.chains
  const wagmiConfig = useConfig()

  const handleSwitchChain = (chainId: number) => {
    const targetConfig = wagmiConfig ?? config
    setIsSwitchPending(true)
    switchChain(targetConfig, { chainId })
      .then(() => setIsSwitchPending(false))
      .catch((err: unknown) => {
        setIsSwitchPending(false)
        console.error('[AccountDrawer] switchChain error:', err)
      })
  }

  const panelRef = useRef<HTMLDivElement>(null)
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && accountDrawer.isOpen) {
        e.preventDefault()
        accountDrawer.close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [accountDrawer.isOpen, accountDrawer.close])

  // useLayoutEffect: run before paint so the panel is positioned before it becomes visible; avoids a flash at default top-right.
  useLayoutEffect(() => {
    if (!accountDrawer.isOpen) {
      setAnchorPosition(null)
      setMoreOptionsOpen(false)
      return
    }
    const updatePosition = () => {
      const style = getAnchorStyle()
      setAnchorPosition(style)
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [accountDrawer.isOpen])

  if (!accountDrawer.isOpen) return null

  const panelStyle: React.CSSProperties = anchorPosition
    ? { top: anchorPosition.top, right: anchorPosition.right, left: 'auto' }
    : { visibility: 'hidden' }

  return (
    <>
      <div
        className="account-drawer__backdrop"
        role="presentation"
        onClick={() => accountDrawer.close()}
      />
      <div
        className="account-drawer"
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-label="Account"
        aria-hidden={!anchorPosition}
      >
        <div className="account-drawer__content">
          {isConnected && address ? (
            <>
              <div className="account-drawer__header">
                <div className="account-drawer__header-left">
                  <div className="account-drawer__address-row">
                    <span className="account-drawer__address" title={address}>
                      {truncateAddress(address)}
                    </span>
                    <div className="account-drawer__address-actions" aria-hidden="true">
                      <button
                        type="button"
                        className="account-drawer__address-icon-btn"
                        onClick={() => handleCopyAddress(address)}
                        title="Copy address"
                        aria-label="Copy full address"
                      >
                        {copyFeedback ? (
                          <span className="account-drawer__address-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        ) : (
                          <span className="account-drawer__address-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </span>
                        )}
                      </button>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="account-drawer__address-icon-btn account-drawer__address-icon-btn--link"
                          title="View in explorer"
                          aria-label="Open address in block explorer"
                        >
                          <span className="account-drawer__address-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                  {chain && (
                    <span className="account-drawer__chain" title={`Selected network: ${chain.name}`}>
                      {chain.name} ({(chain.id as number)})
                    </span>
                  )}
                </div>
                <span className="account-drawer__header-icon" aria-hidden="true" />
              </div>
              {chain?.nativeCurrency && (
                <div className="account-drawer__section">
                  <div className="account-drawer__section-title">Native token</div>
                  <div className="account-drawer__native-token">
                    <span className="account-drawer__native-token-name">{chain.nativeCurrency.name}</span>
                    <span className="account-drawer__native-token-symbol">({chain.nativeCurrency.symbol})</span>
                    {balanceData != null ? (
                      <span className="account-drawer__native-token-balance">
                        {formatBalanceMaxDecimals(balanceData.formatted)} {balanceData.symbol}
                      </span>
                    ) : (
                      <span className="account-drawer__native-token-balance account-drawer__native-token-balance--loading">—</span>
                    )}
                  </div>
                </div>
              )}
              <div className="account-drawer__actions-row">
                <button
                  type="button"
                  className="account-drawer__more-options-btn"
                  onClick={() => setMoreOptionsOpen((open) => !open)}
                  aria-expanded={moreOptionsOpen}
                  aria-controls="account-drawer-more-options"
                >
                  <span className="account-drawer__more-options-icon" aria-hidden="true">
                    {moreOptionsOpen ? '▼' : '▶'}
                  </span>
                  More options
                </button>
                <button
                  type="button"
                  className="account-drawer__disconnect-btn"
                  onClick={() => {
                    disconnect()
                    accountDrawer.close()
                  }}
                  title="Disconnect"
                >
                  <span className="account-drawer__disconnect-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                      <line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                  </span>
                  <span>Disconnect</span>
                </button>
              </div>
              {moreOptionsOpen && chains && chains.length > 1 && (
                <div
                  id="account-drawer-more-options"
                  className="account-drawer__details-inner"
                  role="region"
                  aria-label="More options"
                >
                  <div className="account-drawer__section">
                    <div className="account-drawer__section-title">Switch network</div>
                    {chains.map((c) => {
                      const isCurrent = chain?.id === c.id
                      const envLabel = chainCustomByChainId[c.id]?.environment ?? 'other'
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`account-drawer__row ${isCurrent ? 'account-drawer__row--current' : ''}`}
                          disabled={isCurrent || isSwitchPending}
                          onClick={() => handleSwitchChain(c.id)}
                        >
                          <span className="account-drawer__row-label">{envLabel} ({c.id})</span>
                          {isCurrent && <span className="account-drawer__row-badge">Actual</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="account-drawer__section-title">Connect wallet</div>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  className="account-drawer__row"
                  onClick={() => {
                    connect({ connector })
                    accountDrawer.close()
                  }}
                >
                  {connector.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
