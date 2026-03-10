/**
 * Trigger — clone of Uniswap Web3Status: one button that opens/closes the account drawer.
 * Same icon (/img/hitchhikers.svg) in both states; icon and text color follow state (disconnected vs connected).
 */
import { useAccount, useConnect } from 'wagmi'
import { useAccountDrawer } from './useAccountDrawer'

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function Web3Status() {
  const { address, isConnected } = useAccount()
  const { isPending } = useConnect()
  const accountDrawer = useAccountDrawer()

  const handleClick = () => {
    if (isConnected) {
      accountDrawer.toggle()
    } else {
      accountDrawer.toggle()
    }
  }

  const connectLabel = typeof window.ElectronicThumb?.connectButtonLabel === 'string'
    ? window.ElectronicThumb.connectButtonLabel
    : 'Connect'
  const loadingLabel = typeof window.ElectronicThumb?.connectButtonLoadingLabel === 'string'
    ? window.ElectronicThumb.connectButtonLoadingLabel
    : 'Connecting…'

  if (isPending) {
    return (
      <button type="button" className="web3-status web3-status--loading" onClick={accountDrawer.toggle}>
        <span className="web3-status__icon" aria-hidden="true" />
        {loadingLabel}
      </button>
    )
  }

  if (isConnected && address) {
    return (
      <button type="button" className="web3-status web3-status--connected" onClick={handleClick}>
        <span className="web3-status__icon" aria-hidden="true" />
        <span className="web3-status__address">{truncateAddress(address)}</span>
        <span className="web3-status__chevron" aria-hidden="true">▼</span>
      </button>
    )
  }

  return (
    <button type="button" className="web3-status web3-status--connect" onClick={handleClick}>
      <span className="web3-status__icon" aria-hidden="true" />
      {connectLabel}
    </button>
  )
}
