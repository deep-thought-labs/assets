# Wallet Connect Widget

Embeddable widget so your users can **connect their wallet** (MetaMask, Rabby, etc.) to the **Infinite Drive** network and keep a stable connection on your site. Other widgets can then run transactions or sign messages using that connection.

---

## What it does

- **Connect** — Adds the Infinite Drive network to the user’s wallet and requests account access.
- **Shows state** — Displays connected address, network name, and a disconnect button.
- **For other widgets** — Exposes connection state (`window.DriveWallet`) so other scripts can send transactions or sign without asking again.

---

## How to use it

Add a container and the script. The widget will render the “Connect” / “Disconnect” UI inside the container.

```html
<div id="drive-wallet-widget" data-network="mainnet"></div>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js" async></script>
```

- **`data-network`** — Use `mainnet`, `testnet`, or `creative` depending on which network you want.

That’s enough to get started. You can add more options (theme, callbacks, custom styles) if you need them.

**Try it:** [Demo page](demo.html) (serve the site over HTTP to load network data).

---

## More information

- **[Full technical specification](spec.html)** — Embedding options, configuration, API, styling, security, and versioning.
