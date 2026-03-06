/**
 * Wagmi config — clone of Uniswap interface: same pattern (createConfig, chains, connectors).
 * Minimal set: mainnet + injected (like Uniswap's injected connector).
 */
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
