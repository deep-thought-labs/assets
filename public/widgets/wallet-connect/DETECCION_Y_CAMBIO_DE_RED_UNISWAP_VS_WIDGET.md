# Detección y cambio de red: Uniswap vs nuestro widget

**Objetivo:** Entender por qué nuestro widget no detecta ni cambia la red en la práctica, estudiando exactamente qué hace el repositorio de Uniswap (interface) y en qué nos diferenciamos.

---

## 1. Qué hace Uniswap (interface)

### 1.1 Stack de conexión

- **wagmi** (React + config) como capa entre la UI y el wallet.
- **Config** (`wagmiConfig.ts`): `createConfig({ chains, connectors, client })`.
- **Conectores:** `porto()` (primero), Binance (injected o QR), WalletConnect, `embeddedWallet()`, Coinbase Wallet, Safe. Para extensiones inyectadas usan **porto** (EIP-6963) o **injected** (p. ej. Binance con `provider: () => window.BinanceChain`).

### 1.2 De dónde sale el `chainId` en Uniswap

- **useAccount()** (hook propio que envuelve wagmi): devuelve `wagmiAccount` con `chainId` que viene de **wagmi**.
- **wagmi** obtiene `chainId` del **estado del conector**: el conector (porto, injected, etc.) está conectado a un **provider EIP-1193** y:
  - Se suscribe a **`chainChanged`** del provider y actualiza el estado interno de wagmi.
  - Wagmi (y viem bajo el capó) usa ese estado para `useAccount().chainId` y `useChainId()`.
- **Importante:** En wagmi, si el usuario cambia a una red que **no** está en `chains` del config, wagmi puede seguir mostrando la última red soportada; pero `useAccount().chainId` refleja la red **real** del wallet porque viene del provider/conector.

Conclusión: en Uniswap el `chainId` es **siempre** el que reporta el **mismo provider** con el que se hace connect/switch (el del conector activo), y se actualiza por el evento **chainChanged** de ese provider.

### 1.3 Cómo cambian de red en Uniswap

- **useSelectChain()** usa **useSwitchChain** de wagmi.
- **switchChain({ chainId })** (wagmi): llama al **conector activo** (mismo que dio las cuentas y el chainId).
- El conector (p. ej. porto o injected) ejecuta:
  - `provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] })`.
  - Si error **4902**, el flujo típico es add chain y luego switch (wagmi/viem lo encapsulan).
- **chainId** se pasa como **número** en la API de wagmi; viem lo convierte a **hex** en la RPC (EIP-3326 exige hex).

Resumen: **un solo provider** para todo (cuentas, chainId, switch). Ese provider es el del conector con el que el usuario conectó (porto → EIP-6963, o injected → `window.ethereum` / Binance, etc.).

---

## 2. Qué hace nuestro widget

### 2.1 Provider

- **EIP-6963:** Escuchamos `eip6963:announceProvider` y guardamos `eip6963Provider` (preferencia MetaMask por rdns/nombre) y `eip6963Providers[uuid]`.
- **getProvider():**  
  1) Si hay `eip6963Provider` → lo devolvemos.  
  2) Si no, si hay algún provider en `eip6963Providers` → el primero.  
  3) Si no, **fallback** a `window.ethereum` (si es array: el que tenga `isMetaMask === true` o el primero).

### 2.2 chainId (detección de red)

- **Al conectar:** Flujo `runEnsureChain` + `waitForChainConfirmation()` (chainChanged o fallback 600 ms, timeout 5 s). Guardamos `state.chainIdHex` (y derivados).
- **Cuando el usuario cambia de red en el wallet:** Nos apoyamos en **un único** mecanismo: el listener **`provider.on('chainChanged', state._chainHandler)`** que configuramos en `setupProviderEvents()`.
  - En el handler actualizamos `state.chainIdHex`, `syncDriveWallet()`, refresh, `onChainChanged`.
- **No** hacemos polling de `eth_chainId` en background cuando ya estamos conectados. Si `chainChanged` **no se emite** (o no lo recibe nuestro provider), nuestro estado **nunca** se entera del cambio.

### 2.3 Cambio de red (switch)

- **switchToOurChain(chainParams, coreConfig):** Obtenemos `provider = getProvider()` y `account = state.address`. Llamamos a `runEnsureChain(account, chainParams, coreConfig, provider)`.
- **runEnsureChain** hace `provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] })` (y add si 4902), luego `waitForChainConfirmation()`.
- Usamos el **mismo** `getProvider()` que para conectar y para el listener de `chainChanged`.

---

## 3. Diferencias que pueden explicar “no detecta ni cambia la red”

### 3.1 Provider distinto al “activo” en la pestaña

- **Uniswap:** El conector con el que el usuario conecta **es** el que usa para todo (chainId y switch). Ese conector tiene **un** provider (porto descubre por EIP-6963, pero el conector mantiene la misma referencia).
- **Nosotros:** Podemos estar usando:
  - Un provider obtenido por **EIP-6963** (`eip6963Provider` o el primero de `eip6963Providers`), **o**
  - **window.ethereum** (o un elemento del array).
- **Problema:** En algunos entornos, el provider que inyecta la extensión por **EIP-6963** puede no ser la misma referencia que usa la pestaña para “estar conectada”. O bien `window.ethereum` puede ser un proxy que no reenvía bien eventos o requests. Si nuestro `getProvider()` devuelve un objeto que **no** es el que la extensión considera “conectado” para esa pestaña, entonces:
  - **chainChanged** podría no dispararse para nosotros (o dispararse a otro provider).
  - **wallet_switchEthereumChain** podría ejecutarse sobre un provider que no controla la pestaña y “no hacer nada” visible.

### 3.2 chainChanged no llega

- Algunas versiones de MetaMask o entornos (SES, iframes, múltiples inyecciones) pueden no emitir `chainChanged` en el provider que nosotros tenemos.
- Si no hay **ningún** fallback (p. ej. polling de `eth_chainId` cada X segundos cuando estamos conectados), nuestro estado queda desactualizado y la UI no muestra “otra red” ni el botón de volver.

### 3.3 Orden / momento en que elegimos provider

- Emitimos `eip6963:requestProvider` al cargar. Si la extensión anuncia **después** de que ya hemos tomado `window.ethereum` como fallback, podríamos quedarnos con `window.ethereum` y no usar nunca el provider EIP-6963 (o al revés). Según el orden, podemos acabar con un provider que no sea el que realmente controla la conexión en esa página.

### 3.4 Formato de chainId

- Nosotros pasamos **hex** en `wallet_switchEthereumChain` (correcto según EIP-3326). Uniswap/viem pasan número y viem convierte a hex. No es la causa típica de “no cambia”, pero hay que mantener consistencia (nosotros ya usamos hex).

---

## 4. Resumen: por qué ellos “detectan y cambian” y nosotros no

| Aspecto | Uniswap | Nuestro widget |
|--------|---------|-----------------|
| **Quién da el provider** | Un **conector** (porto, injected, etc.) que el usuario elige al conectar. Un solo provider para todo. | `getProvider()`: EIP-6963 (MetaMask o primero) o fallback `window.ethereum`. Puede no coincidir con el “conector activo” de la pestaña. |
| **Cómo saben el chainId** | Estado del conector, actualizado por **chainChanged** del mismo provider. | Solo **chainChanged** del provider que devolvió `getProvider()`. Sin polling. |
| **Cómo hacen switch** | Mismo conector (mismo provider) que tiene las cuentas y el chainId. | Mismo `getProvider()`. Si ese provider no es el que “manda” en la pestaña, el switch puede no tener efecto visible. |
| **Fallback si chainChanged no llega** | Wagmi/viem pueden tener lógica interna o reconexión. | Ninguno: si no hay evento, no actualizamos. |

Conclusión: la diferencia crítica no es tanto el flujo RPC (requestAccounts, switch, add) sino **qué provider usamos** y **cómo nos enteramos del chainId**. Si el provider no es el correcto o `chainChanged` no se recibe, ni la detección ni el cambio de red funcionarán.

---

## 5. Recomendaciones

1. **Priorizar el mismo provider que “activa” la pestaña**  
   - Probar en nuestro widget **priorizar `window.ethereum`** (o el elemento del array que tenga `isMetaMask`) cuando esté disponible, para alinearnos con el comportamiento típico del conector “injected” de Uniswap y asegurar que usamos el mismo provider que la extensión asocia a la página.
   - Mantener EIP-6963 como opción configurable o como segundo intento si `window.ethereum` no existe.

2. **Fallback de detección: polling de `eth_chainId`**  
   - Cuando estamos conectados, además de `chainChanged`, hacer un **polling suave** (p. ej. cada 2–3 s) de `provider.request({ method: 'eth_chainId' })` y, si difiere de `state.chainIdHex`, actualizar estado y re-render. Así detectamos cambio de red incluso si el evento no se emite.

3. **Un solo provider por “sesión”**  
   - Al conectar, guardar la referencia al provider con el que se hizo `eth_requestAccounts` y usar **esa misma** referencia para chainChanged, switch y polling, en lugar de volver a llamar a `getProvider()` cada vez (que podría devolver otro en teorías de race con EIP-6963).

4. **Logs y diagnóstico**  
   - En modo debug, loguear el origen del provider (EIP-6963 vs window.ethereum), si recibimos chainChanged, y el resultado de cada `wallet_switchEthereumChain`, para poder ver en el cliente si el fallo es “no evento” o “provider equivocado”.

5. **Documentar y probar**  
   - Dejar este análisis en el repo y, en pruebas, comparar explícitamente: mismo navegador y misma extensión, conectar en Uniswap y en nuestro widget y comprobar si el chainId y el switch se comportan igual. Si con `window.ethereum` fijo nuestro widget sí detecta y cambia, confirma que el problema es la elección/uso del provider.

---

## 6. Referencias en el repo Uniswap (interface)

- `apps/web/src/components/Web3Provider/wagmiConfig.ts`: createConfig, porto(), injected(), chains.
- `apps/web/src/hooks/useAccount.ts`: useAccount wagmi + useChainId, chainId soportado.
- `apps/web/src/hooks/useSelectChain.ts`: useSwitchChain(wagmi), switchChain({ chainId }), manejo 4902.
- `apps/web/src/connection/EmbeddedWalletConnector.ts`: switchChain con `provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })`.
- Wagmi/viem: el conector activo es la única fuente de provider para accounts, chainId y switchChain.
