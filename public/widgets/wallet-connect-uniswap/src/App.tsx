/**
 * App — clone of Uniswap layout: Web3Status (trigger) + AccountDrawer (panel in portal).
 */
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmiConfig'
import { Web3Status } from './Web3Status'
import { AccountDrawer } from './AccountDrawer'

const queryClient = new QueryClient()

export function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="app">
          <header className="app__header">
            <span className="app__title">Wallet Connect (Uniswap-style)</span>
            <Web3Status />
          </header>
          <main className="app__main">
            <p>Click &quot;Connect&quot; or the address to open the account drawer.</p>
          </main>
        </div>
        <AccountDrawer />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
