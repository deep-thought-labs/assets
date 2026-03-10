# network-data.json — schema and source of truth

Each network (mainnet, testnet) has a `network-data.json` in its folder (`mainnet/network-data.json`, `testnet/network-data.json`). These files are the **source of truth** for chain and token data in the assets site. Values are taken from the official genesis and ecosystem config. Field names match Cosmos/genesis where applicable; the same structure holds the essential data used by chainlist.org (no separate chainlist block).

## Root fields

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `environment` | string | — | `"mainnet"` or `"testnet"`. Identifies the network. |
| `name` | string | docs / display | Human-readable network name (e.g. "Infinite Improbability Drive"). |
| `chain_id` | string | genesis `chain_id` | Cosmos chain ID (e.g. `infinite_421018-1`). |
| `chain_name` | string | docs | Short name / slug (e.g. `infinite`). Same concept as chainlist `shortName`. |
| `bech32_prefix` | string | docs | Cosmos Bech32 address prefix (e.g. `infinite`). |
| `evm_chain_id` | number | NODE_EVM_CHAIN_ID / EIP-155 | EVM chain ID in decimal (e.g. `421018`). |
| `evm_chain_id_hex` | string | derived | EVM chain ID in hex; must be the hex representation of `evm_chain_id` (e.g. 421018 → `0x66c9a`). |
| `evm_chain_name` | string | — | Chain identifier for EVM context (e.g. `INFINITE`). Same concept as chainlist `chain`. |
| `evm_network_id` | number | — | EVM network ID; for this chain same as `evm_chain_id`. |
| `info_url` | string | — | Project / info URL (e.g. `https://infinitedrive.xyz`). |
| `icon` | string | — | Icon key for wallets/explorers (e.g. `infinite`). |
| `native_currency` | object | genesis `app_state.bank.denom_metadata[0]` | Native currency metadata; structure below. |
| `resources` | object | — | Genesis path, explorer(s), and other assets. |
| `endpoints` | object | — | Endpoints grouped by protocol; each protocol has a list with optional `primary`. See below. |
| `faucets` | array of strings | — | Faucet URLs, if any (optional). |
| `features` | array of objects | — | EVM feature flags, e.g. `[{ "name": "EIP155" }, { "name": "EIP1559" }]` (optional). |
| `explorers` | array of objects | — | Block explorers: `[{ "name", "url", "icon?", "standard?", "primary?" }]`. One may have `primary: true`. |

## native_currency (from genesis bank.denom_metadata)

| Field | Type | Genesis path | Description |
|-------|------|--------------|-------------|
| `name` | string | `name` | Token name (e.g. "Improbability"). |
| `symbol` | string | `symbol` | Token symbol (e.g. "42", "TEST42"). |
| `description` | string | `description` | Token description from genesis. |
| `base` | string | `base` | Base (atomic) denom; exponent 0 (e.g. `drop`, `tdrop`). |
| `display` | string | `display` | Display denom; exponent 18 (e.g. "Improbability"). |
| `denom_units` | array | `denom_units` | List of denom units; each has `denom`, `exponent`, `aliases`. |

Display decimals for EVM/wallets: use the unit with `exponent: 18` (typically 18 decimals).

## denom_units[] (from genesis)

| Field | Type | Description |
|-------|------|-------------|
| `denom` | string | Denom identifier (e.g. `drop`, `Improbability`). |
| `exponent` | number | 0 = base (atomic); 18 = display (1 unit = 10^18 base). |
| `aliases` | array of strings | Alternative names (e.g. `["improbability"]`). |

## resources

| Field | Description |
|-------|-------------|
| `<key>.src` | Local path or absolute URL of the resource. |
| `<key>.curl_output_filename` | Filename for `curl -o` (e.g. `genesis.json`). |
| `<key>.download` | Optional boolean. Default `false`. Only if `true` is the Download (curl) button shown. |
| `<key>.open_in_browser` | Optional boolean. Default `false`. Only if `true` is the value a clickable link and the Open button shown in Actions. |

Standard keys: `genesis`, `network_data`. You can add more with the same structure. `path` is still accepted for backward compatibility.

Explorers are listed in the root `explorers` array; there is no `explorer_url` in resources.

## endpoints (by service key name)

Endpoints are grouped by **service key name** (see [NODE_ENDPOINT_SERVICES.md](NODE_ENDPOINT_SERVICES.md)). Supported keys include public APIs and, optionally, P2P seeds.

Supported keys:

| Key name | Service | Typical use |
|----------|---------|-------------|
| `p2p` | P2P | Seeds / persistent peers (node-to-node); each entry is a seed URL, e.g. `id@host:26656`. |
| `comet-rpc` | RPC CometBFT | Explorers, indexers, low-level queries |
| `grpc` | gRPC (Cosmos SDK) | Cosmos wallets, apps |
| `grpc-web` | gRPC-Web | Browser Cosmos apps |
| `rest` | REST API (Cosmos SDK) | Legacy Cosmos apps |
| `json-rpc-http` | JSON-RPC HTTP (EVM) | MetaMask, dApps, chainlist |
| `json-rpc-ws` | JSON-RPC WebSocket (EVM) | Real-time dApps |

- **Keys**: one of the key names above. Use lowercase with hyphen.
- **Value**: array of endpoint objects (use empty array `[]` if the service is not yet offered for this network).

Each endpoint object:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Endpoint URL. |
| `primary` | boolean | Optional. Exactly one entry per service should have `primary: true`; that one is preferred. |

Whether the "Open" link is shown is determined programmatically by endpoint type (e.g. `comet-rpc`, `json-rpc-http`, `rest`, `grpc-web`).

Example:

```json
"endpoints": {
  "p2p": [
    { "url": "seed-id@seed.example.com:26656", "primary": true }
  ],
  "comet-rpc": [],
  "grpc": [],
  "grpc-web": [],
  "rest": [],
  "json-rpc-http": [
    { "url": "https://evm-rpc.infinitedrive.xyz", "primary": true },
    { "url": "https://backup-rpc.example.com" }
  ],
  "json-rpc-ws": [
    { "url": "wss://evm-ws.infinitedrive.xyz", "primary": true }
  ]
}
```

Normalisation to chainlist `rpc`: collect all `url` from `endpoints.json-rpc-http` and `endpoints.json-rpc-ws` (primary first within each, then by key order), as `[{ "url": "..." }, ...]`.

## explorers[] (block explorers)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Explorer display name. |
| `url` | string | Explorer base URL. |
| `icon` | string | Optional icon key (e.g. `blockscout`). |
| `standard` | string | Optional standard (e.g. `EIP3091`). |
| `primary` | boolean | Optional. Exactly one explorer should have `primary: true`; that one is preferred (e.g. default in MetaMask). |

## Chainlist.org alignment

Chainlist [rpcs.json](https://chainlist.org/rpcs.json) uses a different shape; our schema holds the same essential values in a single structure:

- `name` → chainlist `name`
- `evm_chain_name` → chainlist `chain`
- `chain_name` → chainlist `shortName`
- `evm_chain_id` → chainlist `chainId`
- `evm_network_id` → chainlist `networkId`
- `info_url` → chainlist `infoURL`
- `icon` → chainlist `icon`
- `native_currency` (name, symbol, exponent 18) → chainlist `nativeCurrency` (name, symbol, decimals)
- `endpoints` → chainlist `rpc` (flatten: all `url` from `endpoints.json-rpc-http`, `endpoints.json-rpc-ws`; primary first per service)
- `faucets` → chainlist `faucets`
- `features` → chainlist `features`
- `explorers` → chainlist `explorers`
- `environment === "testnet"` → chainlist `isTestnet`

No nested `chainlist` object; one structure, one source of truth.

## Genesis sources

- Mainnet: [assets.infinitedrive.xyz/mainnet/genesis.json](https://assets.infinitedrive.xyz/mainnet/genesis.json)
- Testnet: [assets.infinitedrive.xyz/testnet/genesis.json](https://assets.infinitedrive.xyz/testnet/genesis.json)

Do not replace or swap field names: each field carries the value indicated above. When updating data, prefer editing the JSON and letting the site consume it.
