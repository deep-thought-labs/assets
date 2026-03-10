/**
 * Wagmi config — createConfig, chains (Infinite Drive), connectors (injected), transports.
 *
 * Chain data source (paths from repo root):
 * - public/mainnet/network-data.json
 * - public/testnet/network-data.json
 * - public/creative/network-data.json
 * Values: name, evm_chain_id, native_currency, endpoints.json-rpc-http[primary], explorers[primary].
 */
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

/** Mainnet — from public/mainnet/network-data.json */
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

/** Testnet — from public/testnet/network-data.json */
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

/** Creative — from public/creative/network-data.json (experimental / playground network) */
export const infiniteDriveCreative = defineChain({
  id: 421018002,
  name: 'Infinite Improbability Drive Creative',
  nativeCurrency: {
    decimals: 18,
    name: 'CreativeImprobability',
    symbol: 'CRE42',
  },
  rpcUrls: {
    default: { http: ['https://evm-rpc-creative.infinitedrive.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Infinite Drive Creative Explorer', url: 'https://creative-scan.infinitedrive.xyz' },
  },
})

/** Environment and other custom chain-derived values (not from viem/wagmi). */
export type ChainEnvironment = 'mainnet' | 'testnet' | 'creative' | null

export interface ChainCustom {
  environment: Exclude<ChainEnvironment, null>
  /** Base unit name (exponent 0), from network-data.json native_currency.base. */
  baseUnit: string
}

/** Single map for all custom values per chainId. Add new chains or fields here. */
export const chainCustomByChainId: Record<number, ChainCustom> = {
  [infiniteDriveMainnet.id]: { environment: 'mainnet', baseUnit: 'drop' },
  [infiniteDriveTestnet.id]: { environment: 'testnet', baseUnit: 'tdrop' },
  [infiniteDriveCreative.id]: { environment: 'creative', baseUnit: 'cdrop' },
}

/** Default chain for the widget (reference; e.g. for logic or docs). */
export const defaultAppChain = infiniteDriveMainnet

export const config = createConfig({
  chains: [infiniteDriveMainnet, infiniteDriveTestnet, infiniteDriveCreative],
  connectors: [injected()],
  transports: {
    [infiniteDriveMainnet.id]: http('https://evm-rpc.infinitedrive.xyz'),
    [infiniteDriveTestnet.id]: http('https://evm-rpc-testnet.infinitedrive.xyz'),
    [infiniteDriveCreative.id]: http('https://evm-rpc-creative.infinitedrive.xyz'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
