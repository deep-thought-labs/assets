# Comparación: Wallet Connect v2 (CROC) vs Widget original (wallet-connect)

## Resumen ejecutivo

| Aspecto | Original (wallet-connect) | V2 (wallet-connect-v2) |
|--------|---------------------------|-------------------------|
| **Propósito** | Conectar wallet a Infinite Drive (mainnet/testnet/creative) | Idem |
| **EIPs** | 6963, 1193, 3326, 3085, 1102 | 6963, 1193, 3326, 3085, 1102 |
| **Tamaño / complejidad** | ~860 líneas, 3 capas (Core, UI, Bridge) | ~145 líneas, un solo módulo |
| **UI** | Incluida (botón, estados, temas) | No incluye UI; el host pone botón y estado |
| **Confirmación de red** | Evento `chainChanged` + timeout 5s + fallback 600ms | Solo `updateState()` con `eth_chainId` tras el switch |
| **SES / desincronización** | Diseñado para no confiar en `eth_chainId` previo; iframe sin lockdown documentado | No contemplado; mismo riesgo de “conectado” falso en SES |
| **API pública** | `window.DriveWallet` (estado) + `DriveWalletWidget` (callbacks) | `DriveWalletV2` (connect, disconnect, getState, on) |
| **Documentación** | ARCHITECTURE, SPECIFICATION, WALLET_CONNECT_OFFICIAL_AUDIT, embed-wallet | README mínimo |

---

## 1. Arquitectura y superficie pública

### Original
- **Core**: lógica pura (provider, sesión, flujo connect/switch/add, eventos).
- **UI**: renderizado del botón, estados (loading, ready, connected, error, no wallet), temas (base/light/dark).
- **Bridge**: orquestación, montaje en contenedor, callbacks `onReady` / `onConnect` / `onDisconnect` / `onError`.
- **Contrato estable**: `window.DriveWallet` (objeto de estado actualizado en tiempo real) y `window.DriveWalletWidget` (config + callbacks). Pensado para embeber un único script y un div; el widget pinta solo.

### V2
- Un único IIFE que expone `DriveWalletV2`: `connect`, `disconnect`, `getState`, `on(event, callback)`.
- Sin UI: la página debe proporcionar botón y área de estado; el script solo ofrece estado y eventos (`stateChange`).
- Más “library” que “widget embeber y listo”.

**Aprendizaje:** El original prioriza integración por embed (script + div + callbacks). La v2 prioriza simplicidad de API y control total del host sobre la UI. Ambas son válidas según el caso de uso.

---

## 2. Descubrimiento del provider (EIP-6963)

### Original
- Listener **síncrono** en carga: `eip6963:announceProvider` + `eip6963:requestProvider`.
- Guarda todos los providers por `uuid`; prefiere MetaMask por `rdns`/`name`; **fallback** a `window.ethereum` (array o único) si no hay ninguno por EIP-6963.
- `getProvider()` devuelve: primero EIP-6963 MetaMask, luego cualquier EIP-6963, luego legacy.

### V2
- `discoverProvider()`: **Promise** que se resuelve cuando llega el primer anuncio de MetaMask (`rdns === 'io.metamask'` o nombre incluye "metamask").
- No hay fallback a `window.ethereum`; si ningún wallet anuncia por EIP-6963, la Promise no se resuelve (en la práctica se queda colgada hasta timeout o error en `connect()`).

**Aprendizaje:** El original es más defensivo (funciona aunque la extensión no anuncie por EIP-6963). La v2 es “solo EIP-6963” y más estricta; en entornos con solo `window.ethereum` antiguo, la v2 no conectaría sin añadir fallback.

---

## 3. Flujo de conexión y cambio de red

### Original
1. `eth_requestAccounts` primero.
2. **Siempre** llama a `wallet_switchEthereumChain` (nunca confía en un `eth_chainId` previo para saltar el switch).
3. Registra listener de **`chainChanged`** y timeout de **5 s**.
4. Solo marca “conectado” cuando:
   - llega **`chainChanged`** con la chainId objetivo, o
   - tras el switch, un **fallback a 600 ms** comprueba `eth_chainId` (caso “ya estaba en la red” y la extensión no emite evento).
5. Si no hay confirmación en 5 s → error, no se actualiza estado.
6. Si 4902 → `wallet_addEthereumChain` + `wallet_switchEthereumChain`; misma lógica de confirmación por evento/fallback.
7. Valida que `rpcUrls` no esté vacío antes de add (EIP-3085).

### V2
1. `eth_requestAccounts`.
2. `wallet_switchEthereumChain`; si 4902 → `wallet_addEthereumChain` + `wallet_switchEthereumChain`.
3. Tras el switch (o add+switch), llama **`updateState()`**: `eth_accounts` + `eth_chainId` y considera conectado si `accounts.length > 0 && chainId === networkData.evm_chain_id_hex`.

**Problema en entornos SES/desincronizados:** En la v2, “conectado” se decide solo con el valor de `eth_chainId` devuelto por el provider. Si el provider está desincronizado (como con SES), puede devolver la chain deseada aunque la UI de MetaMask no haya cambiado; la v2 marcaría conectado igual. El original evita eso al exigir **`chainChanged`** (o el fallback controlado) antes de marcar conectado.

**Aprendizaje:** La documentación de MetaMask recomienda escuchar **`chainChanged`** para detectar el cambio real de red. La v2 no lo usa para confirmar el connect; el original sí. Para robustez frente a SES/desincronización, el patrón del original (evento + timeout + fallback opcional) es el correcto.

---

## 4. Datos de red (network-data.json)

### Original
- `buildAddChainParams(data)` lee el JSON tal como está en el repo: `native_currency`, `endpoints['json-rpc-http']`, `explorers`, `evm_chain_id_hex`, etc.
- Calcula `decimals` desde `denom_units`; usa RPC primary o primero disponible; construye `chainName`, `nativeCurrency`, `rpcUrls`, `blockExplorerUrls` para EIP-3085.

### V2
- Parsea el mismo JSON con nombres ligeramente distintos: `raw.evm_chain_id_hex`, `raw.name`, `raw.native_currency`, `raw.endpoints['json-rpc-http']`, `raw.explorers` (filtra `primary`).
- Construye `addChainParams` equivalente para EIP-3085.
- La estructura del JSON en el repo (con `evm_chain_id_hex`, `endpoints`, `explorers`, `native_currency`) es compatible con ambos; la v2 usa un mapeo más directo y corto.

**Aprendizaje:** La v2 muestra una forma más compacta de mapear el mismo `network-data.json` a los parámetros de EIP-3085; el original es más explícito (decimals desde denom_units, etc.). Ambos son válidos si el JSON no cambia de forma.

---

## 5. Eventos y estado

### Original
- Eventos del provider: `accountsChanged`, `chainChanged`; el widget actualiza `window.DriveWallet` y llama a los callbacks (`onDisconnect`, `onAccountsChanged`, `onChainChanged`).
- Sesión en `sessionStorage` (red, address, chainIdHex, networkName) para restaurar “conectado” al recargar si la red y las cuentas siguen siendo las mismas.
- `disconnect()`: quita listeners del provider, limpia estado y sesión.

### V2
- `provider.on('chainChanged', updateState)` y `provider.on('accountsChanged', updateState)`; también `disconnect`.
- `updateState()` lee `eth_accounts` y `eth_chainId` y emite `stateChange` con el estado derivado.
- No hay sesión persistida; al recargar, la init llama a `updateState()` y refleja el estado actual del wallet (útil si el usuario ya está conectado en MetaMask).
- `disconnect()` solo limpia estado en memoria y emite `stateChange`; no llama a ningún método del provider para “desconectar” (EIP-1193 no define un disconnect estándar; el original tampoco llama a nada en el provider en disconnect).

**Aprendizaje:** La v2 no persiste sesión pero sí refleja el estado real del wallet tras recarga (updateState en init). El original persiste sesión y puede restaurar “conectado” sin nueva interacción; es mejor UX si quieres “seguir conectado” entre recargas. La v2 es más simple y “una sola fuente de verdad” (el provider).

---

## 6. Inicialización

### Original
- No conecta automáticamente; espera a que el usuario haga clic en el botón (o que el host llame al flujo de connect).
- Al cargar: descubre contenedor, obtiene config, hace fetch de network-data, llama `start()` (restaura sesión si aplica, luego `onReady`).

### V2
- IIFE final: `discoverProvider()` → `loadNetworkData()` → `setupEvents()` → `updateState()`.
- Si el usuario ya tiene MetaMask conectado y en la red correcta, tras cargar la página el estado ya aparece como conectado sin clic.

**Aprendizaje:** La v2 ofrece “estado actual al cargar” sin popup; el original requiere un flujo explícito de connect (o restauración de sesión). Depende de si quieres evitar cualquier llamada RPC hasta que el usuario haga clic (original) o mostrar estado real desde el primer paint (v2).

---

## 7. Lo que la v2 hace bien y se puede reutilizar

- **Código corto y legible**: un solo archivo, flujo lineal, fácil de revisar.
- **API tipo library**: `connect()`, `getState()`, `on('stateChange', ...)` es cómoda para integrar en una SPA o página que ya tiene su propia UI.
- **Mapeo compacto** del `network-data.json` a `addChainParams`.
- **Init con `updateState()`**: refleja el estado del wallet nada más cargar, sin sesión persistida.

---

## 8. Lo que el original hace mejor (y conviene mantener o llevar a v2)

- **Confirmación de red por `chainChanged`** (y timeout + fallback): evita estado “conectado” falso cuando el provider está desincronizado (p. ej. SES).
- **Fallback a `window.ethereum`** cuando no hay provider por EIP-6963: mayor compatibilidad.
- **No confiar en `eth_chainId` previo** para saltar el switch: elimina el bug del “already on target chain” en SES.
- **Validación EIP-3085**: no llamar a `wallet_addEthereumChain` si `rpcUrls` está vacío.
- **Sesión persistida**: mejor UX “seguir conectado” entre recargas.
- **UI incluida y temas**: embed listo para usar sin que el host implemente botón/estados.
- **Documentación y auditoría**: ARCHITECTURE, SPECIFICATION, WALLET_CONNECT_OFFICIAL_AUDIT, recomendación de iframe sin lockdown.

---

## 9. Conclusión y recomendación

- **V2**: Buena opción como **library mínima** cuando el host controla toda la UI y no hay riesgo de SES/desincronización (o no es prioritario). Para entornos con SES o con solo `window.ethereum`, habría que añadir al menos: fallback a `window.ethereum`, confirmación de red vía `chainChanged` (y timeout), y no confiar en `eth_chainId` para “ya en la red” antes del switch.
- **Original**: Mejor para **widget embeber y listo**, entornos con posible SES, y cuando se quiere un contrato estable documentado (DriveWallet + DriveWalletWidget) y máxima robustez frente a desincronización.

**Recomendación:** Mantener el original como widget de referencia y producción. Usar la v2 como referencia de API simple y de mapeo de `network-data.json`; si se quiere una “v2” lista para producción, incorporar en ella la lógica de confirmación por `chainChanged` (y fallback/timeout) y el fallback de provider del original.
