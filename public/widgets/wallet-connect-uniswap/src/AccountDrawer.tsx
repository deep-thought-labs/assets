/**
 * Drawer — clone of Uniswap AccountDrawer: panel that opens on trigger click.
 * Disconnected: list of connectors (Connect). Connected: address, chain, Disconnect, Switch chain.
 */
import { useEffect, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useAccountDrawer } from './useAccountDrawer'

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function AccountDrawer() {
  const { address, isConnected, chain } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, chains } = useSwitchChain()
  const accountDrawer = useAccountDrawer()
  const panelRef = useRef<HTMLDivElement>(null)

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

  if (!accountDrawer.isOpen) return null

  return (
    <>
      <div
        className="account-drawer__backdrop"
        role="presentation"
        onClick={() => accountDrawer.close()}
      />
      <div className="account-drawer" ref={panelRef} role="dialog" aria-label="Account">
        <div className="account-drawer__content">
          {isConnected && address ? (
            <>
              <div className="account-drawer__header">
                <span className="account-drawer__address" title={address}>
                  {truncateAddress(address)}
                </span>
                {chain && (
                  <span className="account-drawer__chain">
                    {chain.name} (0x{(chain.id as number).toString(16)})
                  </span>
                )}
              </div>
              {chains && chains.length > 1 && (
                <div className="account-drawer__section">
                  <div className="account-drawer__section-title">Switch network</div>
                  {chains.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="account-drawer__row"
                      onClick={() => switchChain?.({ chainId: c.id })}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="account-drawer__section">
                <button
                  type="button"
                  className="account-drawer__row account-drawer__disconnect"
                  onClick={() => {
                    disconnect()
                    accountDrawer.close()
                  }}
                >
                  Disconnect
                </button>
              </div>
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
