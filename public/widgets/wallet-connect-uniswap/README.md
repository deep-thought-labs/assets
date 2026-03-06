# Wallet Connect — Uniswap-style (v3)

Clon del patrón del widget de conexión de wallet del **repositorio Uniswap (interface)**. No migra nada del widget actual; replica la misma estructura: **wagmi + trigger (Web3Status) + drawer (AccountDrawer)**.

## Stack (como Uniswap)

- **wagmi** (createConfig, chains, connectors)
- **viem** (chains, transports)
- **Jotai** (estado del drawer: open/close/toggle)
- **React** + **Vite**

## Cómo ejecutarlo en local

```bash
cd systems/assets-b/public/widgets/wallet-connect-uniswap
npm install
npm run dev
```

Abre en el navegador la URL que muestre Vite (p. ej. `http://localhost:5173`).

## Build para servir estático

```bash
npm run build
```

La salida queda en `dist/`. Para probar en tu servidor local: sirve la carpeta `dist` desde la ruta del widget (p. ej. `/widgets/wallet-connect-uniswap/` apuntando a `dist/`); así `index.html` y los assets cargan bien. También puedes abrir directamente `dist/index.html` si tu servidor ya sirve esa ruta.

## Estructura (clone Uniswap)

| Uniswap (interface) | Este proyecto |
|---------------------|----------------|
| Web3Status (trigger) | `src/Web3Status.tsx` |
| AccountDrawer (panel) | `src/AccountDrawer.tsx` |
| accountDrawerOpenAtom (Jotai) | `src/accountDrawerAtoms.ts` + `useAccountDrawer.ts` |
| wagmiConfig (createConfig, chains, connectors) | `src/wagmiConfig.ts` |
| useConnect, useDisconnect, useSwitchChain | wagmi hooks en los componentes |

Conectores incluidos por defecto: **injected** (MetaMask, etc.). Se puede añadir WalletConnect con `projectId` en `wagmiConfig.ts`.
