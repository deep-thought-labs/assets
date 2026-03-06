# Wallet Connect Widget

Embeddable widget so your users can **connect their wallet** (MetaMask, Rabby, etc.) to the **Infinite Drive** network and keep a stable connection on your site. Other widgets can then run transactions or sign messages using that connection.

---

## What it does

- **Connect** — Adds the Infinite Drive network to the user's wallet and requests account access.
- **Shows state** — Displays connected address, network name, and a disconnect button.
- **For other widgets** — Exposes connection state (`window.DriveWallet`) so other scripts can send transactions or sign without asking again.

---

## How to use it

Add a container and the script. The widget will render the "Connect" / "Disconnect" UI inside the container.

```html
<div id="drive-wallet-widget" data-theme="light"></div>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js" data-network="mainnet" data-target-id="drive-wallet-widget" async></script>
```

- **In the script:** `data-network` — use `mainnet`, `testnet`, or `creative` depending on which network you want. `data-target-id` must match the container's `id`.
- **In the div:** `data-theme` — visual theme (`base`, `light`, `dark`). Optionally `data-button-label` for the button text.
- **Serve with a server** — Serve the page over HTTP so the widget can load `network-data.json`. For example, from the folder containing your HTML run `npx serve .` or `npx http-server . -p 8080`, then open the URL shown in the browser.

That's enough to get started. You can add more options (callbacks, custom styles) if you need them.

**Try it:** [Demo page](demo.html) — customize the widget and see how it works and the result it returns once connected.

---

## Complete example: minimal HTML page

Below is a full minimal HTML page so you can see **where** the container goes and **how** to include the script. Same structure and same id `drive-wallet-widget` as the snippet above.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My site — Connect wallet</title>
</head>
<body>

  <header>
    <h1>My site</h1>
  </header>

  <main>
    <p>To use this page with Infinite Drive, connect your wallet:</p>

    <!-- Container: the widget renders here (UI attributes: theme, button-label) -->
    <div id="drive-wallet-widget" data-theme="light"></div>
  </main>

  <!-- Script: data and logic (network, target). The div id must match data-target-id. -->
  <script src="https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js" data-network="mainnet" data-target-id="drive-wallet-widget" async></script>

</body>
</html>
```

- **In the `<div>`:** the **container** defines *where* the widget is shown and **UI** options (`data-theme`, `data-button-label`). Its `id` must match the script's `data-target-id`.
- **In the `<script>`:** you set *which* network to use (`data-network`) and *which* element to mount into (`data-target-id`). Data and logic in the script; presentation in the div.

Serve the page over HTTP so the widget can load `network-data.json`. For example, with Node from the folder where your HTML lives:

```bash
npx serve .
```

Or with `http-server`:

```bash
npx http-server . -p 8080
```

Then open in the browser the URL shown (e.g. `http://localhost:3000` or `http://127.0.0.1:8080`).

If you need to customize further (callbacks, styling, multiple containers, etc.), see the **[full technical specification](spec.html)**.

---

## More information

- **[Full technical specification](spec.html)** — Embedding options, configuration, API, styling, security, and versioning.
