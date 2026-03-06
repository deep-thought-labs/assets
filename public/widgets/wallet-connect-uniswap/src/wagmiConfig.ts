/**
 * Wagmi config — clone of Uniswap interface (createConfig, chains, connectors).
 *
 * Única fuente de verdad para las cadenas:
 * - systems/assets-b/public/mainnet/network-data.json
 * - systems/assets-b/public/testnet/network-data.json
 * Valores tomados de: name, evm_chain_id, native_currency, endpoints.json-rpc-http[primary], explorers[primary].
 */
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

/** Mainnet — desde public/mainnet/network-data.json */
export const infiniteDriveMainnet = defineChain({
  id: 421018,
  name: 'Infinite Improbability Drive',
  nativeCurrency: {
    decimals: 18,
    name: 'Improbability',
    symbol: '42',
  },
  rpcUrls: {
    default: { http: ['https://evm-rpc.infinitedrive.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Infinite Drive Explorer', url: 'https://scan.infinitedrive.xyz' },
  },
})

/** Testnet — desde public/testnet/network-data.json */
export const infiniteDriveTestnet = defineChain({
  id: 421018001,
  name: 'Infinite Improbability Drive Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'TestImprobability',
    symbol: 'TEST42',
  },
  rpcUrls: {
    default: { http: ['https://evm-rpc-testnet.infinitedrive.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Infinite Drive Testnet Explorer', url: 'https://testnet-scan.infinitedrive.xyz' },
  },
})

export const config = createConfig({
  chains: [infiniteDriveMainnet, infiniteDriveTestnet],
  connectors: [injected()],
  transports: {
    [infiniteDriveMainnet.id]: http('https://evm-rpc.infinitedrive.xyz'),
    [infiniteDriveTestnet.id]: http('https://evm-rpc-testnet.infinitedrive.xyz'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
