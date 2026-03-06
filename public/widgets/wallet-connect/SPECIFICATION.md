# Wallet Connect Widget — Technical Specification

**Document type:** Technical specification / Architecture  
**Component:** Infinite Drive Assets — Embeddable Wallet Connect Widget  
**Status:** Draft  
**Version:** 0.1  
**Language:** English

This document uses **CommonMark / GFM only** (headers, tables, fenced code blocks, lists, links) so it can be rendered reliably in the browser and in any Markdown viewer. Avoid raw HTML or non-standard extensions.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Scope and Responsibilities](#2-scope-and-responsibilities)
3. [Architecture Overview](#3-architecture-overview)
4. [Network Data and Wallet APIs](#4-network-data-and-wallet-apis)
5. [Embedding and Integration](#5-embedding-and-integration)
6. [Configuration Reference](#6-configuration-reference)
7. [API Reference](#7-api-reference)
8. [Styling and Customization](#8-styling-and-customization)
9. [Security and Privacy](#9-security-and-privacy)
10. [Versioning and Compatibility](#10-versioning-and-compatibility)
11. [Appendix: File Structure and URLs](#11-appendix-file-structure-and-urls)

---

## 1. Introduction

This specification describes the **Wallet Connect Widget**, a static, embeddable JavaScript component for the Infinite Drive ecosystem. The widget allows third-party sites to offer users a single, consistent way to connect an EIP-1193–compatible wallet (e.g. MetaMask, Rabby) to an Infinite Drive network (mainnet, testnet, or creative) and to maintain a stable connection state on the host page.

The widget is the **connection layer**: it does not perform transactions or sign messages. Other widgets or application logic may use the connection state exposed by this widget to execute those operations. Implementers embed the widget via a script tag and optionally a container element; they may configure it through data attributes or a global configuration object and may style it using default themes, CSS variables, or fully custom styles.

**Target audience:** Implementers integrating the widget into their sites; developers building other widgets that depend on this connection state; technical reviewers.

---

## 2. Scope and Responsibilities

### 2.1 In scope

| Responsibility | Description |
|----------------|-------------|
| **Connect** | Add the target Infinite Drive network to the user’s wallet (if needed) and request account access via EIP-1193 (`wallet_addEthereumChain`, `eth_requestAccounts`). |
| **Connection state** | Maintain and expose a stable connection state on the host page: connected vs disconnected, current address, current chain. |
| **User-facing state** | Display connection status, truncated address, network name (or chain ID), and a disconnect control. |
| **Disconnect** | Provide a “Disconnect” action that clears connection state on the host (the site no longer treats any account as active). Disconnect is local to the site; it does not revoke the site’s authorization in the wallet. |
| **Foundation for other widgets** | Expose a read-only state object and optional callbacks so that other widgets on the same page can perform transactions, signing, or other operations using the existing connection. |

### 2.2 Out of scope

- Sending transactions, signing messages, or executing arbitrary contract calls. Those are the responsibility of other widgets or the host application, which consume the connection state provided by this widget.
- Wallet discovery or multi-wallet UI beyond the single provider exposed as `window.ethereum`.
- Server-side sessions or authentication; state is client-side only (optionally persisted in `sessionStorage` for session restore).

---

## 3. Architecture Overview

### 3.1 High-level flow

1. **Load:** The host page includes the widget script (and optionally a container element). The script runs, reads configuration (data attributes and/or `window.DriveWalletWidget`), and resolves the base URL for network data (same origin as the script).
2. **Network data:** The widget fetches `/{network}/network-data.json` (e.g. `mainnet`, `testnet`, `creative`) to obtain chain parameters and RPC endpoints. No chain parameters are hardcoded in the widget.
3. **Wallet detection:** The widget checks for `window.ethereum`. If absent, it shows a clear message (e.g. “Install MetaMask or an EVM-compatible wallet”) and does not attempt connection.
4. **Connect:** On user action, the widget calls `wallet_addEthereumChain` (if needed) and then `eth_requestAccounts`. On success, it updates internal state and optionally persists to `sessionStorage`.
5. **State and UI:** The widget keeps internal state (`connected`, `address`, `chainId`, `chainIdHex`, `networkName`, `environment`, `provider`) and renders the appropriate UI (disconnected vs connected, with address and network and disconnect button). It subscribes to `accountsChanged` and `chainChanged` to keep state and UI in sync.
6. **Exposure:** The same state is exposed on a global object (e.g. `window.DriveWallet`) for other scripts. Callbacks configured by the implementer are invoked on connect, disconnect, account/chain change, and error.

### 3.2 Component model

- **Single script:** The widget is implemented as one JavaScript file (e.g. `wallet-connect.js`), optionally with a separate CSS file. For minimal integration, the script may inject default styles so that a single `<script>` tag is sufficient.
- **No framework dependency:** Vanilla JavaScript only; no React, Vue, or other framework. This avoids version conflicts and keeps the widget usable on any host page.
- **Scoped DOM:** All UI is rendered inside a container provided by the host or created by the widget. All CSS uses a fixed prefix (e.g. `.drive-wc-*`) to avoid collisions with host styles.

### 3.3 Data sources

- **Network parameters:** From `network-data.json` on the same origin as the script (see [Section 4](#4-network-data-and-wallet-apis)).
- **Wallet:** From `window.ethereum` (EIP-1193 provider). No other backend or third-party API is required for core behavior.

---

## 4. Network Data and Wallet APIs

### 4.1 Network data JSON

The widget loads network parameters from:

```
GET {origin}/{network}/network-data.json
```

Where `{network}` is one of: `mainnet`, `testnet`, `creative` (configurable by the implementer).

The widget uses at least the following fields:

| JSON path | Purpose |
|-----------|---------|
| `evm_chain_id` | Numeric chain ID for the EVM chain. |
| `evm_chain_id_hex` | Same as hex string (e.g. `"0x66c9a"`) for `wallet_addEthereumChain`. |
| `evm_chain_name` | Human-readable chain name for the wallet. |
| `evm_network_id` | Network ID. |
| `endpoints.json-rpc-http` | Array of RPC endpoints; the widget uses the first (or primary) URL. |
| `native_currency` | `name`, `symbol`, and decimals (derived from `denom_units`). |
| `explorers` (optional) | Block explorer URLs for `blockExplorerUrls` in `wallet_addEthereumChain`. |

Other fields in `network-data.json` may be ignored by the widget. The canonical schema is documented elsewhere (e.g. `references/NETWORK_DATA_JSON_SCHEMA`).

### 4.2 EIP-1193 usage

- **wallet_addEthereumChain:** Called with `chainId`, `chainName`, `nativeCurrency`, `rpcUrls`, and optionally `blockExplorerUrls` derived from the loaded network data. Used to add the Infinite Drive network to the user’s wallet if not already present.
- **eth_requestAccounts:** Called to request account access. On success, the returned accounts are stored as the current address and the widget enters the “connected” state.
- **accountsChanged:** Subscribed to on the provider; the widget updates its state and UI when the user switches accounts in the wallet.
- **chainChanged:** Subscribed to on the provider; the widget updates its state and UI when the user switches chains (and may show a notice if the chain is not the intended Infinite Drive network).

---

## 5. Embedding and Integration

### 5.1 Container + script (recommended)

The implementer provides a container element and loads the widget script. The script finds the container (by id or data attribute) and mounts the UI inside it.

```html
<div id="drive-wallet-widget" data-network="mainnet"></div>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js" async></script>
```

- **Advantage:** Full control over placement (e.g. header, sidebar, modal). Configuration can be set via data attributes on the container.

### 5.2 Script with mount target

The script tag carries configuration via data attributes; the widget mounts into an element identified by `data-target-id` (or equivalent).

```html
<script
  src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js"
  data-network="mainnet"
  data-mount="auto"
  data-target-id="drive-wallet"
  async
></script>
<div id="drive-wallet"></div>
```

### 5.3 Programmatic configuration (SPA / global config)

For applications that load the script dynamically or need to pass callbacks, the implementer sets a global configuration object before the script runs. The script reads it on load.

```html
<script>
  window.DriveWalletWidget = {
    network: 'mainnet',
    onConnect: function(state) { console.log('Connected', state); },
    onDisconnect: function() { console.log('Disconnected'); }
  };
</script>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js" async></script>
```

Configuration from the global object takes precedence over (or merges with) data attributes, as defined in [Section 6](#6-configuration-reference).

---

## 6. Configuration Reference

### 6.1 Data attributes

Configuration is split by **where** it is set: **script tag = data/logic** (network, target); **container (div) = UI** (theme, button label). All attributes are optional unless stated.

| Attribute | Where | Values | Default | Description |
|-----------|--------|--------|---------|-------------|
| `data-network` | script | `mainnet` \| `testnet` \| `creative` | `mainnet` | Which network`s `network-data.json` to load. |
| `data-target-id` | script | string (id) | — | ID of the DOM element into which the widget mounts. |
| `data-mount` | script | `auto` \| (other) | — | If `auto`, widget may create or use a target element. |
| `data-theme` | container | `base` \| `light` \| `dark` \| (impl-defined) | `base` | Visual theme when using default styles. |
| `data-button-label` | container | string | (e.g. “Connect to Infinite Drive”) | Label for the primary connect button. |
| `data-styles` | container | `default` \| `custom` \| `none` | `default` | Styling mode. See [Section 8](#8-styling-and-customization). |
| `data-layout` | script or container | `inline` \| `dropdown` | `inline` | Layout: `inline` = single block; `dropdown` = trigger + floating panel. |
| `data-drive-widget` | container | `wallet-connect` | — | Identifies the element as the wallet-connect container. |

### 6.2 Global configuration object

If the script finds `window.DriveWalletWidget` (or the chosen global name) at load time, it uses it for configuration and callbacks. Properties may override or complement data attributes. The same convention applies: data/logic (`network`, `targetId`) vs UI (`theme`, `styles`, `buttonLabel`).

| Property | Type | Description |
|----------|------|-------------|
| `network` | `string` | Same as `data-network` (script). |
| `theme` | `string` | Same as `data-theme` (container). |
| `styles` | `string` | Same as `data-styles` (container). |
| `buttonLabel` | `string` | Same as `data-button-label` (container). |
| `targetId` | `string` | Same as `data-target-id` (script). |
| `layout` | `string` | Same as `data-layout`: `inline` \| `dropdown`. |
| `onReady` | `function()` | Called when the widget has loaded and network data is ready. |
| `onConnect` | `function(state)` | Called when the user has connected; `state` includes `address`, `chainId`, `chainIdHex`, `networkName`, `environment`. |
| `onDisconnect` | `function()` | Called when the user has disconnected via the widget. |
| `onAccountsChanged` | `function(accounts: string[])` | Optional. Called when the provider emits `accountsChanged`. |
| `onChainChanged` | `function(chainIdHex: string)` | Optional. Called when the provider emits `chainChanged`; argument is chain ID in hex. |
| `onError` | `function(message \| Error)` | Called when an error occurs (no wallet, user rejected, fetch failed, etc.). |
| `onPanelOpen` | `function()` | Optional. Called when the panel is opened (dropdown layout only; also when opening via `openPanel()`). |
| `onPanelClose` | `function()` | Optional. Called when the panel is closed (dropdown layout; includes close via click-outside, Escape, or disconnect). |

---

## 7. API Reference

### 7.1 State object (read-only)

After the widget has loaded, it exposes the current connection state on a global object (e.g. `window.DriveWallet`). Other scripts and widgets may read this object at any time. The widget keeps the object updated as the user connects, disconnects, or changes account/chain.

**Suggested shape:**

```ts
interface DriveWalletState {
  connected: boolean;
  address: string | null;       // EIP-55 or lowercase; null when disconnected
  chainId: number | null;       // decimal (e.g. 421018); null when disconnected or after chainChanged
  chainIdHex: string | null;    // hex (e.g. "0x66c9a"); derived from evm_chain_id when on that network; from wallet on chainChanged
  networkName: string | null;
  environment: string | null;   // "mainnet" | "testnet" | "creative" when connected; null when disconnected
  provider: EIP1193Provider | null; // same as window.ethereum when connected
}
```

- **connected:** `true` if the widget considers the user connected (has address and has not clicked Disconnect).
- **address:** Current account address, or `null` when disconnected.
- **chainId:** Chain ID in **decimal** (e.g. `421018`). From network-data.json `evm_chain_id` only; `null` when not from our fetched config (e.g. after `chainChanged`).
- **chainIdHex:** Chain ID in **hex** (e.g. `"0x66c9a"`). Derived in the widget from `evm_chain_id` when connected to that network; from the wallet on `chainChanged` if the user switched chain.
- **networkName:** Human-readable network name from network data, or `null`.
- **environment:** From network-data.json `environment` (e.g. `"mainnet"`) when connected to that network; `null` when disconnected or after `chainChanged`.
- **provider:** The EIP-1193 provider used for the connection; other widgets may use it for `eth_sendTransaction`, `personal_sign`, etc.

Implementers and other widgets must treat this object as read-only. The widget is the single owner of connection state.

### 7.2 Programmatic refresh: `refreshBalances()`

The widget adds a function to the global configuration object so that implementers can refresh balances on demand:

- **`window.DriveWalletWidget.refreshBalances`** (function, set by the widget after load)
- **Effect:** Requests the current native balance (`eth_getBalance`) and, if token contracts are configured, each token’s balance and metadata (`eth_call`). Updates the state object and the connected-state UI.
- **Use case:** Update displayed balances after a transfer, on a custom “Refresh” button, or on a schedule. The widget also updates automatically on account/chain change events.
- **Safety:** Safe to call when disconnected; does nothing if no address is connected.

The connected-state UI includes a **Refresh** link that performs the same refresh. Both the button and a programmatic call use the same internal logic.

### 7.3 Panel API (dropdown layout)

When the widget is configured with `layout: 'dropdown'`, the global configuration object is extended with functions to control the floating panel:

- **`window.DriveWalletWidget.openPanel`** — Opens the panel (no-op if already open). Invokes `onPanelOpen` callback when the panel becomes open.
- **`window.DriveWalletWidget.closePanel`** — Closes the panel (no-op if already closed). Invokes `onPanelClose` callback when the panel becomes closed.
- **`window.DriveWalletWidget.togglePanel`** — Toggles the panel open/closed; callbacks are invoked as above.

The panel closes automatically when the user clicks outside the trigger and panel, presses Escape, or disconnects. In inline layout these functions are still present but have no visible effect (there is no separate panel).

### 7.4 Callbacks

Callbacks are set via the global configuration object ([Section 6.2](#62-global-configuration-object)). The widget invokes them at the specified lifecycle events. Signatures are as above; the widget does not guarantee a particular `this` binding. Exceptions thrown inside callbacks are caught and logged; they do not break widget behavior.

---

## 8. Styling and Customization

The implementer can choose how the widget is styled on their site: use default styles, customize via CSS variables, or supply fully custom styles.

### 8.1 Default styles

- **Mode:** `data-styles="default"` or omit `data-styles`.
- **Behavior:** The widget applies its own styles (injected or from `wallet-connect.css`). Theme can be selected with `data-theme` (e.g. `light`, `dark`, `cyberpunk`).
- **Use case:** Zero effort; widget looks correct out of the box.

### 8.2 Customization via CSS variables

- **Mode:** `data-styles="default"` (or equivalent) with the implementer overriding variables.
- **Behavior:** The widget uses CSS custom properties (e.g. `--drive-wc-button-bg`, `--drive-wc-button-color`, `--drive-wc-font-family`) for colors, typography, and spacing. All interactive and text elements use a stable class prefix (e.g. `.drive-wc-*`). The implementer can override these variables in a selector that wraps the widget container.
- **Use case:** Match the host’s brand without changing structure or markup.

**Example:**

```css
#drive-wallet-widget {
  --drive-wc-button-bg: #00ff41;
  --drive-wc-button-color: #0a0a0a;
  --drive-wc-font-family: "Courier New", monospace;
}
```

### 8.3 Fully custom styles

- **Mode:** `data-styles="custom"` or `data-styles="none"`.
- **Behavior:** The widget does not inject presentational styles (or injects only minimal layout that does not affect look). All elements use semantic, stable class names (e.g. `.drive-wc-root`, `.drive-wc-button`, `.drive-wc-address`, `.drive-wc-disconnect`). The implementer provides all visual styling in their own stylesheet.
- **Use case:** Full control over appearance and integration into an existing design system.

### 8.4 Class naming

- **Prefix:** All widget classes use a single prefix (e.g. `drive-wc-`) to avoid collisions with host CSS.
- **Stable names:** Class names are part of the widget’s contract; they will not be removed or renamed in a way that breaks implementers’ selectors within the same major version.

Suggested classes (non-exhaustive):

| Class | Purpose |
|-------|---------|
| `.drive-wc-root` | Root container of the widget UI. |
| `.drive-wc-button` | Primary action button (e.g. Connect). |
| `.drive-wc-address` | Element showing the truncated address. |
| `.drive-wc-network` | Element showing the network name or chain ID. |
| `.drive-wc-disconnect` | Disconnect control. |
| `.drive-wc-message` | Status or error message. |
| `.drive-wc-loading` | Loading state indicator. |
| `.drive-wc-trigger` | In dropdown layout: the clickable trigger (button or connected pill) that opens the panel. |
| `.drive-wc-trigger-wrap` | Wrapper element around the trigger in dropdown layout. |
| `.drive-wc-panel` | In dropdown layout: the floating panel that contains connect/disconnect UI. |
| `.drive-wc-dropdown-wrap` | In dropdown layout: wrapper that contains both trigger and panel. |
| `.drive-wc-connected` | Pill or block showing connected state (address + network). |
| `.drive-wc-tokens` | Container for token balance rows. |
| `.drive-wc-token-row` | Single row for native or ERC-20 balance. |

---

## 9. Security and Privacy

### 9.1 Security

- **No arbitrary HTML:** The widget does not inject HTML or text from the host page or from user-controlled input into the DOM in an executable or unsafe way. Only data from the trusted `network-data.json` and fixed strings are used for labels and structure.
- **No eval:** The widget does not use `eval` or interpret configuration (e.g. callback names) as code. Callbacks are set only via the global configuration object as function references.
- **CORS:** Network data is loaded from the same origin as the script by default. If the script is served from a different subdomain in the future, CORS must allow the host to fetch the network-data JSON from the assets origin (or the widget must be configured with a permitted data origin).

### 9.2 Privacy

- **No tracking:** The widget does not send user data, addresses, or chain IDs to any server other than the wallet provider (e.g. MetaMask) and the RPC/network-data host that the user implicitly uses when connecting.
- **Client-only state:** Connection state is kept in memory and optionally in `sessionStorage` for session restore. No server-side session or authentication is introduced by the widget.

---

## 10. Versioning and Compatibility

- **Script URL:** Implementers may use an unversioned URL (e.g. `widgets/wallet-connect/wallet-connect.js`) for “latest” behavior. For stability, a versioned path (e.g. `widgets/wallet-connect/v1/wallet-connect.js`) may be offered; the same specification applies, with no breaking changes within the same major version.
- **Breaking changes:** Changes to the state object shape, callback signatures, class names, or data attribute semantics will be reflected in a new major version and documented.
- **Deprecation:** Deprecated options or APIs will be documented and supported for at least one minor version before removal.

---

## 11. Appendix: File Structure and URLs

### 11.1 Suggested layout under the assets host

```
public/
  widgets/
    wallet-connect/
      wallet-connect.js      # Single bundle (logic + optional inline styles)
      wallet-connect.css      # Optional standalone stylesheet
      embed.js               # Optional loader that injects script + CSS
    WALLET_CONNECT_SPECIFICATION.md  # This document
```

### 11.2 Example public URLs

- Script: `https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js`
- Styles: `https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.css`
- Network data (mainnet): `https://assets.infinitedrive.xyz/mainnet/network-data.json`

The script may derive the base URL from its own `src` so that it works regardless of the exact domain (e.g. staging vs production) as long as network data is served from the same origin.
