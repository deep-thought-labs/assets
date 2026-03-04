# Assets

**Reference data and static assets for Project 42 (Infinite Drive ecosystem).**

> _A cypherpunk nation in cyberspace. Powered by improbability._

This is the assets repository of **Project 42**: public data and documentation for the ecosystem. Developed by [Deep Thought Labs](https://deep-thought.computer). Learn more at [infinitedrive.xyz](https://infinitedrive.xyz).

---

## What’s in the repo

- **`public/`** — Site root:
  - **`index.html`** — Home (networks, widgets).
  - **`mainnet/`**, **`testnet/`**, **`creative/`** — Per-network genesis, `network-data.json`, and a detail page.
  - **`templates/`** — Shared HTML fragment for network pages (e.g. `network-page.html`); used by mainnet, testnet, and creative.
  - **`widgets/`** — Utilities.
  - **`references/`** — Schema and reference docs.
  - **`css/`**, **`js/`** — Shared styles and scripts.

## Viewing locally

Opening **`public/index.html`** directly in the browser (`file://`) works for the home page.

The **mainnet** and **testnet** detail pages load their content from `network-data.json` via `fetch()`. Browsers block that when the page is opened from disk, so those pages need to be served over HTTP.

From the root of this repository (the directory that contains `public/`):

```bash
npx serve public
```

Or use the local server that always returns 200 for HTML (avoids Safari blank page on navigation):

```bash
node server.js
```

Then open localhost on the port shown (e.g. `http://localhost:3000`) in your browser.

**Requirement:** [Node.js](https://nodejs.org/) (for `npx` or `node`). If mainnet/testnet fail to load from disk, the page shows an error that suggests this command.

## Routes (when served)

| Path | Description |
|------|-------------|
| `/` | Home (networks, widgets) |
| `/mainnet/` | Mainnet detail |
| `/mainnet/genesis.json` | Mainnet genesis |
| `/mainnet/network-data.json` | Mainnet network data |
| `/testnet/` | Testnet detail |
| `/testnet/genesis.json` | Testnet genesis |
| `/testnet/network-data.json` | Testnet network data |
| `/creative/` | Creative (temporary / Phoenix testnet) detail |
| `/creative/genesis.json` | Creative genesis |
| `/creative/network-data.json` | Creative network data |
| `/widgets/` | Widgets |
| `/widgets/wallet-connect/` | Wallet Connect widget: short overview and how to use |
| `/widgets/wallet-connect/spec.html` | Wallet Connect full technical specification (requires HTTP) |
| `/references/NETWORK_DATA_JSON_SCHEMA.html` | network-data.json schema |
| `/references/NODE_ENDPOINT_SERVICES.html` | Node endpoint and service types |

## Deploy

Create a Cloudflare project linked to this repository. No build command is required. **`wrangler.toml`** at the root has the configuration; ensure the **`name`** in it matches the project name in Cloudflare. Deploy with **`npx wrangler deploy`** (or via Cloudflare’s pipeline).

---

## Community

- **Project:** [infinitedrive.xyz](https://infinitedrive.xyz)
- **Lab:** [Deep Thought Labs](https://deep-thought.computer)
- **X:** [@DeepThought_Lab](https://x.com/DeepThought_Lab)
- **Telegram:** [Deep Thought Computer](https://t.me/+nt8ysid_-8VlMDVh)

---

## License

Apache 2.0

---

_Project 42. Building infrastructure for the cypherpunk nation. A [Deep Thought Labs](https://deep-thought.computer) project._
