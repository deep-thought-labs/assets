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

## CORS (cross-origin)

When the Wallet Connect widget (or any page) is **embedded or run from another origin** (e.g. a local HTML that loads the script from this site, or another domain), the browser treats `fetch()` to this site as cross-origin. The server must send **CORS** headers so the browser allows the response.

- **Local (`node server.js`):** Responses include `Access-Control-Allow-Origin: *`. So a page on another port or origin can load the script and fetch `network-data.json` from this server.
- **Remote (Cloudflare):** The file **`public/_headers`** configures CORS for static assets. After deploy, JSON and assets under `/mainnet/`, `/testnet/`, `/creative/`, `/widgets/` are served with `Access-Control-Allow-Origin: *`.

### Cómo comprobar si CORS está bien configurado

**1. Con `curl` (reproduces la petición cross-origin):**

```bash
curl -I -H "Origin: http://localhost:3000" https://TU-DOMINIO/mainnet/network-data.json
```

(o contra local: `curl -I -H "Origin: http://localhost:9999" http://localhost:3000/mainnet/network-data.json`)

En la respuesta debe aparecer:

```http
Access-Control-Allow-Origin: *
```

(o el origen concreto que uses). Si no aparece, el navegador bloqueará el `fetch()` desde ese origen.

**2. En el navegador (DevTools):**

1. Abre una página de **otro origen** que cargue el script de este sitio y haga el `fetch` (o la demo del widget incrustada en otro puerto/origen).
2. Pestaña **Network**; recarga; localiza la petición a `network-data.json` (o al script).
3. Haz clic en esa petición → **Headers** → **Response Headers**. Debe figurar `access-control-allow-origin: *` (o el origen correcto).

Si la petición falla en rojo y en la consola ves un error tipo "CORS policy" o "No 'Access-Control-Allow-Origin' header", CORS no está configurado o no aplica a esa ruta.

**Mismo origen (todo en localhost:3000):** Si la página, el script y el `fetch` son todos a `http://localhost:3000`, no hay petición cross-origin y CORS no interviene; el widget funcionará aunque no veas esas cabeceras.

---

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
