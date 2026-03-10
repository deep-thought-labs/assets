# Electronic Thumb — Architecture

**Electronic Thumb** is a wallet-connection widget (injected provider) with network switching for [Infinite Drive](https://infinitedrive.xyz/blockchain). In code and API it appears as `ElectronicThumb`. The name is a nod to the Sub-Etha Sens-O-Matic from *The Hitchhiker's Guide to the Galaxy*—the device hitchhikers use to flag down passing spacecraft. This widget follows a **trigger + drawer** pattern: wagmi/viem handle the wallet logic; we configure and render the UI.

For an overview and links to resources, see the [Electronic Thumb index](index.html). For the essential steps to embed and configure the widget, use the [Quick start](quick-start.html) page.

**Serving this site.** This documentation and the widget (when tried from these pages) must be served over HTTP to work correctly. **Node.js is required** to run the local server. Run the command below **inside the folder that contains your HTML file** (e.g. the folder where you saved the example page):

```
npx serve .
```

In production, your site is served by your host; no extra step for end users.

---

## Stack (external)

| Role | Library |
|------|--------|
| Connect, disconnect, switch network, state | **wagmi** |
| Chains, types, transports | **viem** |
| Drawer state (open/closed) | **Jotai** (1 atom) |
| App and queries | **React** + **@tanstack/react-query** |
| Build | **Vite** |

We have implemented and configured this stack and built a simple, friendly UI with a plug-and-play integration: any developer with basic HTML can add the widget to their site and use it without extra tooling.

---

## Chain data source

Network data is published by this site at three public endpoints:

- **Mainnet:** `/mainnet/network-data.json` (or the site’s mainnet network-data URL)
- **Testnet:** `/testnet/network-data.json` (or the site’s testnet network-data URL)
- **Creative:** `/creative/network-data.json` (or the site’s creative network-data URL). Creative is the experimental / playground network (Infinite Improbability Drive Creative; native token CRE42).

The widget is configured with chain id, name, native currency, RPC URLs, and block explorers from that data. The **environment** (mainnet / testnet / creative / other) is derived from `chainId` in code — there are no custom fields on the chain object.

---

## High-level structure

- **Application:** React app with WagmiProvider and QueryClientProvider; main UI is a status trigger (Connect button or address + chevron) and an account drawer (connectors, address, current network, switch network, disconnect).
- **State:** One Jotai atom for drawer open/closed; all wallet state comes from wagmi.
- **Styling:** Dedicated CSS for `.web3-status` and `.account-drawer`.
- **Build output:** A single script bundle (and assets) suitable for embedding.

Documentation pages (e.g. demo, architecture, styling) are served from the same site as the widget.

---

## Data flow (summary)

1. **Connect:** User opens drawer → chooses connector (e.g. Injected) → `connect({ connector })` (wagmi) → wagmi exposes `isConnected`, `address`, `chain`.
2. **Disconnect:** Disconnect button → `disconnect()` (wagmi) → drawer closes.
3. **Switch network:** Buttons in “Switch network” → `switchChain(config, { chainId })` (wagmi/actions). The current network is shown in the header and with an “Actual” badge in the list.

All wallet behaviour (events, persistence, provider) is handled by wagmi; components read hooks and call `connect`, `disconnect`, and `switchChain`.

---

## Scope and authentication

This widget is limited to **wallet connection**: connect, show address and network, disconnect, and switch network. It does not manage sessions or backend authentication.

For **cryptographically assured authentication** (proving that the address belongs to the user and not to an intermediary or spoofed provider), the **site builder** must implement a flow where the user **signs a message** (e.g. EIP-4361, applicable on [Infinite Drive](https://infinitedrive.xyz/blockchain)) and the **backend verifies the signature** before establishing the session. That flow is outside the scope of this widget.

---

## Static embed and implementer API

The widget is distributed as a single script (IIFE). The implementer adds a single div with the `electronic-thumb-widget` attribute (no value required) and loads the script; no iframe or build step is required in their project.

**Single global:** `window.ElectronicThumb`

| Use | Content |
|-----|---------|
| **Read (state)** | The widget updates: `connected`, `address`, `chainId`, `chainIdHex`, `networkName`, `environment`, `nativeCurrency` (includes `baseUnit`), `nativeBalance`, `nativeBalanceBase`, `provider`. |
| **Config (before loading the script)** | The implementer sets optional callbacks, `anchorSelector`, `connectButtonLabel`, `connectButtonLoadingLabel`, `connectButtonImage` (URL for the Connect button icon), etc. |
| **Methods (set by the widget when it loads)** | `refresh()` — re-syncs state and may trigger callbacks. |

**Callbacks (all optional):** The implementer chooses which to use. All receive **the same state object** (snapshot at that time).

| Callback | When it is called |
|----------|--------------------|
| `onStateUpdate(state)` | Any state change (connect, disconnect, change network/account, or after `refresh()`). |
| `onConnect(state)` | On connect. |
| `onDisconnect(state)` | On disconnect. |
| `onChainChanged(state)` | On network change. |
| `onAccountsChanged(state)` | On address/account change. |

**State (common shape):** All callbacks and the object on `window.ElectronicThumb` expose the same state shape. Below is what each field represents.

**State fields — meaning of each:**

| Field | Type | Meaning |
|-------|------|--------|
| `connected` | boolean | Whether a wallet is connected. `true` if the user has connected and the widget has an address; `false` otherwise. |
| `address` | string \| null | The connected wallet address (EVM format, e.g. `0x…`). `null` when not connected. |
| `chainId` | number \| null | The numeric chain ID of the current network (e.g. `421018` for mainnet). `null` when not connected. From the wallet/chain. |
| `chainIdHex` | string \| null | The same chain ID in hexadecimal with `0x` prefix (e.g. `"0x66c9a"`). Derived from `chainId` for use in RPC or UIs that expect hex. `null` when not connected. |
| `networkName` | string \| null | Human-readable name of the current network (e.g. `"Infinite Improbability Drive"`). `null` when not connected. From the chain config. |
| `environment` | string \| null | Our label for the network: `"mainnet"`, `"testnet"`, or `"creative"`. `null` when not connected or when the chain is not one of the known three. Derived from `chainId` via the widget config. |
| `nativeCurrency` | object \| null | Data for the chain’s native token. `null` when not connected. See subfields below. |
| `nativeCurrency.name` | string | Display name of the native token (e.g. `"Improbability"`, `"TestImprobability"`). |
| `nativeCurrency.symbol` | string | Symbol of the native token (e.g. `"42"`, `"TEST42"`, `"CRE42"`). |
| `nativeCurrency.decimals` | number | Number of decimals for the native token (typically `18`). |
| `nativeCurrency.baseUnit` | string \| null | Name of the smallest unit of the native token (e.g. `"drop"`, `"tdrop"`, `"cdrop"`). From the widget config; `null` for unknown chains. |
| `nativeBalance` | string \| null | Current balance of the connected address in the native token, human-readable (e.g. `"1.234"`). `null` when not connected or while loading. From the wallet/RPC. |
| `nativeBalanceBase` | string \| null | Same balance in the smallest unit (base unit), as a string for precision (e.g. `"1234000000000000000"`). `null` when not connected or while loading. From the wallet/RPC. |
| `provider` | boolean \| null | In the serialized state (callbacks, JSON): `true` if an EIP-1193 provider is available, `null` otherwise. The actual provider object is not serialized to avoid circular refs. |

No ERC‑20 or other tokens are included; the implementer can obtain them via BlockScout or another source.

**Loading:** The script looks for the first element with the `electronic-thumb-widget` attribute and mounts the React app there. No value is required; the presence of the attribute is enough. That div is the only supported way to specify the container (you can give it an `id`, e.g. `my-electronic-thumb`, for your own CSS or for use with `anchorSelector`).

**Panel anchoring:** The widget supports two behaviours. (1) **Default:** the floating panel is anchored to the widget container (the div with the `electronic-thumb-widget` attribute), so it opens directly below the trigger button. (2) **Optional:** you can set `window.ElectronicThumb.anchorSelector` before loading the script (e.g. `"#my-menu"` or `".wallet-box"`); then the panel is anchored to that element instead, opening below it and updating on scroll/resize. Use the default when the widget is the only reference; use `anchorSelector` when you want the panel to align with a different part of your layout (e.g. a header bar that wraps the widget). All widget CSS variables, including panel spacing, are defined on the widget container; see the styling documentation.

---

## Implementer usage: reading state, callbacks, and methods

These examples show how your site can get values from the widget, react to events via callbacks, and call the widget’s methods.

### 1. Config and callbacks (before loading the script)

Define `window.ElectronicThumb` **before** the widget script runs. The widget keeps your callbacks and calls them when state changes.

```html
<script>
  window.ElectronicThumb = {
    anchorSelector: '#header-menu',   // optional: panel opens below this element (default: the widget div)
    onStateUpdate: function (state) {
      // state = { connected, address, chainId, chainIdHex, networkName, environment, ... }
      if (state.connected) {
        console.log('Wallet:', state.address, 'Network:', state.networkName);
      }
    },
    onConnect: function (state) {
      console.log('User connected:', state.address);
      // e.g. enable "My account" or fetch user data
    },
    onDisconnect: function () {
      console.log('User disconnected');
      // e.g. clear session or redirect
    },
    onChainChanged: function (state) {
      console.log('Network changed to:', state.networkName);
    }
  };
</script>
<script src="/widgets/electronic-thumb/electronic-thumb.js"></script>
```

### 2. Reading current state (after the script has loaded)

Once the widget is loaded, `window.ElectronicThumb` is updated by the widget. Read it anytime to get the latest snapshot.

```javascript
var g = window.ElectronicThumb;

if (g.connected) {
  console.log(g.address);        // e.g. "0x1234…abcd"
  console.log(g.networkName);    // e.g. "Infinite Drive Mainnet"
  console.log(g.chainId);        // number
  console.log(g.environment);    // e.g. "mainnet", "testnet", or "creative"
  console.log(g.nativeCurrency?.symbol, g.nativeBalance);  // e.g. "42" "1.234"
} else {
  console.log('Not connected');
}
```

Use this to show/hide parts of your page, show the current network, or pass `address` to your backend.

### 3. Calling `refresh()`

If your page needs to re-sync with the wallet (e.g. after returning from another tab or after a long time), call `refresh()`. The widget updates its state and, if you set `onStateUpdate`, that callback is invoked with the new snapshot.

```javascript
var g = window.ElectronicThumb;
if (g && typeof g.refresh === 'function') {
  g.refresh();
}
```

Typical use: a “Refresh” button on your site, or when the page becomes visible again.

---

Documentation: [wagmi](https://wagmi.sh), [viem](https://viem.sh).
