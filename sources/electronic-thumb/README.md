# Electronic Thumb

**Official widget name.** Wallet connection widget (Uniswap-style pattern): **wagmi + trigger (Web3Status) + drawer (AccountDrawer)** for [Infinite Drive](https://infinitedrive.xyz/blockchain).

All paths in this README are from the **repository root** (the folder that contains `sources/` and `public/`).

## Requirements

- **Node.js** — Required to run `npm install` and `npm run build` (or `npm run dev`). Install from the [official site](https://nodejs.org/) or any other method (e.g. nvm, Homebrew, your system package manager). The repository’s deploy script (`npm run deploy` from the root) also uses Node to build this project and copy the result into `public/widgets/electronic-thumb/`.

## Stack (Uniswap-style)

- **wagmi** (createConfig, chains, connectors)
- **viem** (chains, transports)
- **Jotai** (drawer state: open/close/toggle)
- **React** + **Vite**

## Local preview (full site)

To preview the **whole site** (including this widget’s docs, Quick start, and Architecture) locally, run from the **repository root**:

```bash
npm start
```

Then open e.g. `http://localhost:3000/widgets/electronic-thumb/` in your browser. This serves the contents of `public/`; run `npm run deploy` from the root first if you’ve changed this widget so that `public/widgets/electronic-thumb/` is up to date.

## Run locally (widget only)

To develop the **widget UI** in isolation (Vite dev server):

```bash
cd sources/electronic-thumb
npm install
npm run dev
```

Open the URL shown by Vite (e.g. `http://localhost:5173`).

## Build

From **this folder** (`sources/electronic-thumb`):

```bash
npm run build
```

Output goes to `dist/` (`electronic-thumb.js` and assets). The repository’s deploy script runs this same command and then copies `dist/` and `html/` into `public/widgets/electronic-thumb/` (creating that folder if needed).

## Deploy (update `public/`)

From the **repository root**:

```bash
npm run deploy
```

That script runs `npm install` and `npm run build` in this project and copies `dist/` and `html/` to `public/widgets/electronic-thumb/`. Run it after changing the widget or its docs so the site serves the latest version. See the root **README.md** for how the deploy script and static serving work.

## Production

When the site is deployed (e.g. Cloudflare Pages), **no extra configuration** is needed. The repository’s build command should be **`npm run deploy`**: it builds this widget (and any other projects in `sources/`) and fills `public/`; the host then deploys `public/` as static files. Add `npm run deploy` as the build command in your host (e.g. Cloudflare “Build command”); no additional steps.

## Structure (Uniswap clone)

| Uniswap (interface) | This project |
|---------------------|----------------|
| Web3Status (trigger) | `src/Web3Status.tsx` |
| AccountDrawer (panel) | `src/AccountDrawer.tsx` |
| accountDrawerOpenAtom (Jotai) | `src/accountDrawerAtoms.ts` + `useAccountDrawer.ts` |
| wagmiConfig (createConfig, chains, connectors) | `src/wagmiConfig.ts` |
| useConnect, useDisconnect, switchChain (wagmi/actions) | wagmi in components |

Default connectors: **injected** (MetaMask, etc.). WalletConnect can be added with `projectId` in `wagmiConfig.ts`.

## How to embed the widget

To embed the widget on your site: add a div with the `electronic-thumb-widget` attribute (and optionally `id="my-electronic-thumb"`), load `electronic-thumb.js` (IIFE) from the widget URL (e.g. `https://assets.infinitedrive.xyz/widgets/electronic-thumb/electronic-thumb.js`), define before it (optional) `window.ElectronicThumb` with callbacks and/or `anchorSelector`, and the script mounts the UI in that container. For local development you can also run the widget as a full app (`index.html` + `#root`). API details in **ARCHITECTURE.md**.

## Panel anchoring (anchorSelector)

If you set `window.ElectronicThumb.anchorSelector` before loading the script (e.g. `"#my-anchor"`), the floating panel opens **below that element** and follows its position on scroll. You can anchor the menu to a div, a menu item, or any node. If you do not set `anchorSelector`, the panel uses fixed position (variables `--et-drawer-top`, `--et-drawer-right`). See the [Quick start](html/quick-start.html) page for an example.

## Styling

The widget exposes **CSS variables** (`--et-*`) for colors, sizes, borders, and spacing. Define the variables on the widget container (the element with the `electronic-thumb-widget` attribute; you can give it an `id` to target it from your CSS) to match your site. Full list in **STYLING.md**.
