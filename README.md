# Assets

**Reference data and static assets for Project 42 ([Infinite Drive](https://infinitedrive.xyz/) ecosystem).**

> _A cypherpunk nation in cyberspace. Powered by improbability._

This repository holds the public site: network data, docs, and embeddable widgets. Developed by [Deep Thought Labs](https://deep-thought.computer). Learn more at [infinitedrive.xyz](https://infinitedrive.xyz).

---

## Requirements

- **Node.js** — Required to run the repository scripts (`npm start`, `npm run deploy`). You can install it from the [official site](https://nodejs.org/) or by any other method (e.g. nvm, Homebrew, your system package manager). No other global tools are required; each widget in `sources/` has its own dependencies installed via `npm install` when you run the deploy script.

---

## How it’s built and served

- **Most of the site is static.** HTML, CSS, JS, JSON, and images under `public/` are served as-is. No build step is needed for those files.
- **Some widgets have their own build.** For example, the Electronic Thumb widget lives in `sources/electronic-thumb/` and is built with Vite. The **deploy script** (`npm run deploy`) runs each project’s build and **copies the output into the right folders under `public/`** (e.g. `public/widgets/electronic-thumb/`). The script creates destination folders as needed.
- **After deploy, everything in `public/` is static.** A web server (or CDN) only needs to serve the contents of `public/`. Users get plain HTML, JS, CSS, and JSON—no server-side rendering.

---

## What’s in the repo

- **`public/`** — Site root (what gets served):
  - **`index.html`** — Home (networks, widgets).
  - **`mainnet/`**, **`testnet/`**, **`creative/`** — Per-network genesis, `network-data.json`, and a detail page.
  - **`templates/`** — Shared HTML for network pages.
  - **`widgets/`** — Widget bundles and docs (e.g. Electronic Thumb). Populated by the deploy script from `sources/`.
  - **`references/`** — Schema and reference docs.
  - **`css/`**, **`js/`** — Shared styles and scripts.

- **`sources/`** — Source code for projects that are built (e.g. `sources/electronic-thumb/`). Each has its own `package.json` and build (e.g. Vite). The deploy script builds them and copies results into `public/`.

- **`scripts/`** — Repository scripts:
  - **`deploy.js`** — Reads `deploy.config.js`, runs `npm install` and `npm run build` in each listed project under `sources/`, then copies `dist/` and optional folders (e.g. `html/`) into the configured destination under `public/`. Creates destination folders if they don’t exist.
  - **`server.js`** — Local static server for `public/` (used by `npm start`).
  - **`deploy.config.js`** — List of projects and their destination paths. Edit this to add or change widgets.

---

## Commands (from repo root)

Run these from the **repository root** (the folder that contains `public/`, `sources/`, and `scripts/`).

| Command | Purpose |
|--------|---------|
| **`npm start`** | **Local preview.** Starts a local server that serves `public/` at `http://localhost:3000`. Use this to preview the site locally, including widget docs and Quick start pages. |
| **`npm run deploy`** | **Build and copy.** For each project in `scripts/deploy.config.js`, runs `npm install` and `npm run build` in `sources/<project>/`, then copies the build output (and any extra folders like `html/`) into the configured path under `public/`. Creates destination folders as needed. Run this after changing code in `sources/` so that `public/` is up to date before you serve or deploy. |

Manual equivalents: `node scripts/server.js` (preview) and `node scripts/deploy.js` (build and copy). Project list and destinations: **`scripts/deploy.config.js`**.

---

## CORS (cross-origin)

When a widget or page is **embedded or run from another origin** (e.g. a page on another domain that loads a script from this site), the browser treats `fetch()` to this site as cross-origin. The server must send **CORS** headers so the browser allows the response.

- **Local (`npm start` / `node scripts/server.js`):** Responses include `Access-Control-Allow-Origin: *`, so a page on another port or origin can load scripts and fetch JSON from this server.
- **Remote (Cloudflare):** The file **`public/_headers`** configures CORS for static assets. After deploy, JSON and assets under `/mainnet/`, `/testnet/`, `/creative/`, `/widgets/` are served with `Access-Control-Allow-Origin: *`.

### Checking CORS

**1. With `curl` (simulates a cross-origin request):**

```bash
curl -I -H "Origin: http://localhost:3000" https://YOUR-DOMAIN/mainnet/network-data.json
```

(Or against local: `curl -I -H "Origin: http://localhost:9999" http://localhost:3000/mainnet/network-data.json`.)

The response should include:

```http
Access-Control-Allow-Origin: *
```

If it doesn’t, the browser will block `fetch()` from that origin.

**2. In the browser (DevTools):**

1. Open a page from **another origin** that loads a script from this site and performs the `fetch` (or an embedded widget on another port/origin).
2. Open the **Network** tab; reload; find the request to `network-data.json` (or the script).
3. Click that request → **Headers** → **Response Headers**. You should see `access-control-allow-origin: *` (or the specific origin you use).

If the request fails and the console shows a CORS error (e.g. “No 'Access-Control-Allow-Origin' header”), CORS is not set or does not apply to that path.

**Same origin (everything on localhost:3000):** If the page, script, and `fetch` are all to `http://localhost:3000`, there is no cross-origin request and CORS does not apply; the widget will work even if you don’t see those headers.

---

## Production deploy

Connect this repository to your host (e.g. Cloudflare Pages). Set the **build command** to **`npm run deploy`**. That command builds the widgets in `sources/` and copies their output into `public/`; the host then deploys the contents of `public/` as static files. No extra build step or env vars are needed. After deploy, the whole site (including `/widgets/electronic-thumb/`) is served from `public/`.

If you use **Wrangler** directly: **`wrangler.toml`** at the root has the config; ensure **`name`** matches your Cloudflare project. Run **`npm run deploy`** to refresh `public/`, then **`npx wrangler deploy`** (or use Cloudflare’s pipeline with build command `npm run deploy`).

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
