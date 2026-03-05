# Wallet Connect Widget — Architecture

## 1. Purpose of this document

This document describes the **separation between logic and UI** in the widget so that:

- **Implementers** get a **stable contract**: `window.DriveWallet` and callbacks behave the same regardless of themes or UI updates.
- **Developers** can change themes, styles, or add new UI options without touching connection/session logic.
- **Future updates** to appearance do not break existing integrations.

---

## 2. Stable contract (guaranteed to consumers)

The following are the **public API** and behavior that implementers can rely on. Changes to these would be breaking.

### 2.1 Global state: `window.DriveWallet`

Always an object with the same shape (updated in real time):

| Property         | Type    | Description |
|------------------|---------|-------------|
| `connected`      | boolean | Whether a wallet is connected. |
| `address`        | string \| null | Current account address (or null). |
| `chainId`   | number \| null | Chain ID in **decimal** (e.g. `421018`). From network-data.json `evm_chain_id`; `null` when not from our fetched config (e.g. after `chainChanged`). |
| `chainIdHex` | string \| null | Chain ID in **hex** (e.g. `"0x66c9a"`). Derived in widget from `evm_chain_id` when on that network; from wallet on `chainChanged` if user switched. |
| `networkName`    | string \| null | Human-readable network name (from network data). |
| `environment`    | string \| null | From network-data.json `environment` (e.g. `"mainnet"`) when connected to that network; `null` when disconnected or after `chainChanged`. |
| `provider`       | object \| null | EIP-1193 provider when connected. |

**Guarantee:** The widget keeps this object updated on connect, disconnect, and account/chain changes. Other scripts can read it at any time. The **shape and meaning** of these fields will not change in a breaking way.

### 2.2 Callbacks (`window.DriveWalletWidget`)

Optional callbacks set by the implementer before loading the script:

| Callback           | When it is called |
|--------------------|--------------------|
| `onReady`         | Widget has loaded and network data is ready. |
| `onConnect`       | User connected; argument: `{ address, chainId, chainIdHex, networkName, environment }`. |
| `onDisconnect`    | User disconnected (from widget or wallet). |
| `onError`         | An error occurred; argument: error. |
| `onAccountsChanged` | Wallet reported account change; argument: `accounts` array. |
| `onChainChanged`  | Wallet reported chain change; argument: `chainId` (hex). |

**Guarantee:** The **names, invocation timing, and argument shapes** of these callbacks will not change in a breaking way. New optional callbacks may be added.

### 2.3 Configuration (data attributes and global)

Implementers configure the widget via:

- **Global:** `window.DriveWalletWidget = { network?, targetId?, theme?, buttonLabel?, ...callbacks }`
- **Script tag:** `data-network`, `data-target-id`, `data-theme`
- **Container:** `data-theme`, `data-button-label`, `data-network`

**Guarantee:** Existing option names and semantics (e.g. `network`, `targetId`, `theme`, `buttonLabel`) remain stable. New options may be added (e.g. new themes) without breaking current ones.

---

## 3. Internal layers

The widget is structured in three **internal** layers. Only the contract above is public; the rest is implementation detail.

### 3.1 Core (logic only — no DOM)

**Responsibility:** Connection state, session persistence, wallet provider, and network data. **No DOM, no styles, no rendering.**

- **State:** Single source of truth: `connected`, `address`, `chainId`, `networkName`, `provider`.
- **Session:** Save/restore from `sessionStorage` (key, format, restore flow).
- **Network:** Resolve `network-data.json` URL, fetch, build `wallet_addEthereumChain` params.
- **Provider:** Detect `window.ethereum`, request accounts, add chain, subscribe to `accountsChanged` / `chainChanged`.
- **API:** `syncDriveWallet()` (writes to `window.DriveWallet`), callbacks (onConnect, onDisconnect, onError, etc.).
- **Entry:** `start(config, callbacks)` runs fetch + optional restore, then calls back with current state and chain params. `connect(chainParams)`, `disconnect()` update state and notify via a single **onStateChange(state)** callback.

**Stability:** Changes here must preserve the public contract (DriveWallet shape, callback timing, session behavior). UI does not depend on core internals, only on the state snapshot and the entry points (start, connect, disconnect).

### 3.2 UI (presentation only)

**Responsibility:** Render the widget into the DOM based on **state + UI config**. No connection logic, no session, no provider.

- **Inputs:** Container element, **UI config** (theme, buttonLabel, network for labels), optional **state snapshot** (for connected view), optional **chain params** (for labels).
- **Outputs:** DOM updates only (loading, no wallet, error, ready button, connected bar).
- **Themes:** All visual variants (base, light, dark) and future themes live here. CSS and markup only.

**Stability:** We can add themes, change styles, or add new UI options (e.g. `data-button-label`) without changing core. Core never reads theme or DOM.

### 3.3 Bridge (orchestration)

**Responsibility:** Glue between Core and UI; DOM discovery and config parsing.

- Reads **config** from script/container/global (network, targetId, containers, theme, buttonLabel, callbacks).
- Calls **Core** `start()`, `connect()`, `disconnect()`; registers **onStateChange(state)** and re-renders all containers using the **UI** layer.
- Handles errors and retry (e.g. second fetch) and decides which UI view to show (error, ready, no wallet).
- **forEachContainer:** Applies the correct theme per container and calls the right render function.

**Stability:** The bridge is the only place that knows about “containers” and “themes”. Core stays UI-agnostic; UI stays logic-agnostic.

**Implementation note:** Core, UI, and Bridge live in a single file (`wallet-connect.js`) so that embedders only need one script. The boundaries are enforced by structure and comments, not by separate modules.

---

## 4. Data flow (summary)

1. **Load:** Bridge gets config → Core `start(config, { onReady, onError })` → Core fetches network, restores session if applicable → Core calls **onReady(state, chainParams)** → Bridge renders (ready or connected) in all containers.
2. **User clicks Connect:** Bridge calls Core `connect(chainParams)` → Core does wallet flow → updates state → **onStateChange(state)** → Bridge re-renders all containers (connected).
3. **User clicks Disconnect / wallet disconnects:** Bridge calls Core `disconnect()` or Core reacts to provider events → state cleared → **onStateChange(state)** → Bridge re-renders (ready).
4. **Account/chain change in wallet:** Core’s provider handlers update state → **onStateChange(state)** → Bridge re-renders (connected).

State always flows **Core → onStateChange → Bridge → UI**. UI never mutates state; it only displays the snapshot it receives.

---

## 5. Guarantee for implementers

- **Stable:** `window.DriveWallet`, callback names and semantics, and existing config options will remain reliable across updates.
- **Safe to evolve:** New themes, new UI options, or new callback names can be added without breaking existing integrations. Logic (Core) and presentation (UI) are separated so that we can change one without breaking the other.
