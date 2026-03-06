# Auditoría: Wallet Connect Widget vs documentación oficial

Este documento mapea cada parte del widget contra las EIP y la documentación de MetaMask, para garantizar que la lógica sigue al pie de la letra las especificaciones.

## Referencia de comportamiento (Fase Core)

**Referencia de verdad para la lógica del Core:** Comportamiento observable de la interfaz web de **Uniswap** (connect, disconnect, switch chain, add chain, refresh, sesión) + **EIP-1193, EIP-1102, EIP-3326, EIP-3085, EIP-6963** + documentación oficial de **MetaMask** (add/switch network, EIP-6963). Donde nuestro Core difiera de esta referencia, se alinea con ella (no se conserva la implementación actual por inercia).

| Área | Referencia (Uniswap + EIPs + MetaMask) | Nuestro widget | Estado |
|------|----------------------------------------|----------------|--------|
| Connect | requestAccounts primero; luego switch/add chain; confirmación por chainChanged o fallback controlado; no confiar en eth_chainId previo | Igual (ver §1 y §5) | OK |
| Disconnect | Limpiar estado local; no llamar a método “disconnect” en el provider | Igual | OK |
| Cambio de red (chainChanged) | Listener actualiza estado; opción de “volver a nuestra red” con mismo flujo que connect | Igual | OK |
| Refresh | Tras connect/accountsChanged/chainChanged; refreshBalances() manual | Igual | OK |
| Sesión | Restaurar solo si misma red + cuentas + chainId; no popup en load | Igual (ver §6) | OK |
| Provider | EIP-6963 + fallback a window.ethereum | Igual (ver §1) | OK |

**Core.4–Core.7 (verificación):** chainChanged actualiza estado y syncDriveWallet, no se marca desconectado solo por cambio de red (§4 implícito en setupProviderEvents). Refresh: tras connect, accountsChanged y chainChanged se llaman refreshNativeBalance y refreshTokenBalances; refreshBalances() expuesto en DriveWalletWidget (Core.5). Sesión: restore solo con misma red + eth_accounts + eth_chainId; sin eth_requestAccounts en load (Core.6, ver §6). Provider: EIP-6963 announce/request, preferencia MetaMask por rdns/nombre, fallback window.ethereum (Core.7, ver §1).

---

## Referencias oficiales

| Especificación | URL | Uso en el widget |
|----------------|-----|-------------------|
| EIP-1193 | https://eips.ethereum.org/EIPS/eip-1193 | Provider API: `request()`, eventos `chainChanged`, `accountsChanged`, `on`/`removeListener` |
| EIP-1102 | https://eips.ethereum.org/EIPS/eip-1102 | `eth_requestAccounts`: solicitar acceso a cuentas (opt-in) |
| EIP-3326 | https://eips.ethereum.org/EIPS/eip-3326 | `wallet_switchEthereumChain`: cambiar la cadena activa del wallet |
| EIP-3085 | https://eips.ethereum.org/EIPS/eip-3085 | `wallet_addEthereumChain`: sugerir añadir una cadena |
| EIP-695 | https://eips.ethereum.org/EIPS/eip-695 | `eth_chainId`: formato hex string del chain ID |
| EIP-6963 | https://eips.ethereum.org/EIPS/eip-6963 | Multi Injected Provider Discovery: eventos `eip6963:announceProvider` / `eip6963:requestProvider` |
| MetaMask: Add a network | https://docs.metamask.io/wallet/how-to/manage-networks/add-network/ | Flujo recomendado: intentar switch, si 4902 entonces add (y luego switch de nuevo) |
| MetaMask: EIP-6963 | docs.metamask.io (Connect / interoperability) | "We recommend using this mechanism to connect to MetaMask"; evita conflictos con `window.ethereum` y entornos SES. |

---

## 1. Provider (EIP-1193) y descubrimiento (EIP-6963)

- **request(args)**: el widget usa `provider.request({ method, params })` para todas las RPC. Correcto.
- **Eventos**: se usan `provider.on('accountsChanged', ...)` y `provider.on('chainChanged', ...)`; EIP-1193 exige Node EventEmitter-style (`on`, `removeListener`). Correcto.
- **chainChanged**: el argumento debe ser `chainId: string` (hex). El widget recibe `id` y lo normaliza con `chainIdToHex(id)`. Correcto.
- **accountsChanged**: argumento `accounts: string[]`. El widget comprueba `!accounts || !accounts.length` para desconectar. Correcto.
- **Obtención del provider (alineado con Uniswap/injected)**:
  - Para maximizar compatibilidad con detección y cambio de red en todos los entornos, el widget **prioriza `window.ethereum`** cuando existe (si es array: el que tenga `isMetaMask === true` o el primero). Así se usa el mismo provider que el conector "injected" típico (Uniswap, etc.) y se reciben correctamente `chainChanged` y las respuestas a `wallet_switchEthereumChain`.
  - Si no hay `window.ethereum`, se usa el provider de **EIP-6963** (preferencia MetaMask por rdns/nombre, o el primero anunciado). Ver `DETECCION_Y_CAMBIO_DE_RED_UNISWAP_VS_WIDGET.md`.
  - Además del listener **chainChanged**, el widget hace **polling** de `eth_chainId` cada 2,5 s cuando está conectado, para detectar cambio de red en entornos donde el evento no se emite.
- **Confirmación real del cambio de red (EIP-1193, chainChanged)** (Core.2 implementado):
  - MetaMask documenta: "Listen to the 'chainChanged' event to detect a user's network change." El widget llama a `eth_requestAccounts` primero; luego asegura la cadena (switch/add si hace falta). No se usa `eth_chainId` previo para saltar el switch. Solo se marca "conectado" cuando (a) se recibe el evento **chainChanged** con la chainId objetivo, o (b) un fallback a 600 ms comprueba `eth_chainId` por si la extensión no emitió el evento. Timeout 5 s si no hay confirmación; en ese caso no se marca conectado y se notifica error. Implementación: `waitForChainConfirmation()` (listener chainChanged + setTimeout 600 ms para un `eth_chainId` + timeout 5 s).

---

## 2. eth_requestAccounts (EIP-1102)

- Debe solicitar acceso a cuentas; puede mostrar UI; devuelve `Promise<Array<string>>` o rechaza.
- El widget llama a `provider.request({ method: 'eth_requestAccounts' })` solo después de estar en la cadena correcta (mismo chain o tras switch/add). Correcto.
- No se llama en el arranque sin interacción del usuario para no abrir popups sin contexto.

---

## 3. wallet_switchEthereumChain (EIP-3326)

- **Parámetros**: un solo objeto con `chainId: string` (hex, p. ej. `"0x1"`).
- **Retorno**: `null` si el wallet cambió de cadena; error en caso contrario.
- **chainId**: entero como string hexadecimal según eth_chainId (EIP-695).

El widget:
- Pasa `params: [{ chainId: chainIdHex }]` con `chainIdHex` como string (p. ej. `"0x66c9a"`). Correcto.
- Se intenta **primero** el switch (recomendado por MetaMask y EIP). Correcto.
- Si el wallet devuelve **4902** (cadena no conocida), se usa `wallet_addEthereumChain` y luego se vuelve a llamar a `wallet_switchEthereumChain`. Correcto (EIP-3085 no garantiza que add seleccione la cadena).

---

## 4. wallet_addEthereumChain (EIP-3085)

- **Parámetros**: `AddEthereumChainParameter`: `chainId` (obligatorio), `rpcUrls?`, `chainName?`, `nativeCurrency?`, `blockExplorerUrls?`, etc.
- **rpcUrls**: "The wallet MUST reject the request if the rpcUrls field is not provided, or if the rpcUrls field is an empty array."
- **nativeCurrency**: si se proporciona, debe tener `name`, `symbol`, `decimals` (entero no negativo).
- **URLs**: solo `https` (no `file:` ni `http:`).
- **Tras add**: "The chain MUST NOT be assumed to be automatically selected by the wallet." Por tanto, **siempre** llamar a `wallet_switchEthereumChain` después de un add exitoso.

El widget:
- Construye los params desde `network-data.json` (chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls). Correcto.
- Debe **no** llamar a `wallet_addEthereumChain` si `rpcUrls` está vacío (EIP-3085 lo prohíbe); en ese caso debe mostrar error y registrar en consola.
- Tras add, llama a `wallet_switchEthereumChain` y luego a `eth_requestAccounts`. Correcto.

---

## 5. Flujo de conexión (resumen según documentación)

1. **Primero** `eth_requestAccounts` (EIP-1102) — activa el provider y obtiene cuenta; popup si aplica.
2. Obtener cadena actual: `eth_chainId` (EIP-695, hex string).
3. Si la cadena actual coincide con la deseada → esperar confirmación (chainChanged o fallback 600 ms); si timeout 5 s, no conectar.
4. Si no coincide:
   - Llamar a `wallet_switchEthereumChain` (EIP-3326) con `chainId` en hex.
   - Si éxito → esperar confirmación (chainChanged o fallback 600 ms); si llega, actualizar estado; si timeout 5 s, no conectar.
   - Si error **4902** → llamar a `wallet_addEthereumChain` (EIP-3085) con parámetros completos (y `rpcUrls` no vacío); luego `wallet_switchEthereumChain`; luego esperar confirmación igual.
   - Otros errores → no marcar como conectado; notificar al usuario (y opcionalmente log).

---

## 6. Sesión y restauración

- No está definida en EIP-1193/3085/3326; es decisión del dapp.
- El widget usa `sessionStorage` para restaurar “conectado” si la misma red y cuentas siguen disponibles.
- **Condición de restauración**: misma red configurada, `eth_accounts` devuelve cuentas, y `eth_chainId` coincide con la cadena de esa red. Si la cadena no coincide (p. ej. usuario cambió de red en MetaMask), no restaurar y mostrar botón Connect para forzar el flujo switch/requestAccounts. Correcto según el flujo anterior.

---

## 7. Códigos de error (EIP-1193 / MetaMask)

- **4001**: User Rejected Request.
- **4100**: Unauthorized.
- **4200**: Unsupported Method.
- **4900**: Disconnected (todas las cadenas).
- **4901**: Chain Disconnected (cadena concreta).
- **4902**: (MetaMask) cadena no añadida al wallet; usar `wallet_addEthereumChain`.

El widget debe comprobar `error.code` o `error.error?.code` y, en desarrollo, registrar en consola para depuración.

---

## 8. Checklist de cumplimiento

- [x] Provider vía `request()` únicamente para RPC.
- [x] Eventos `accountsChanged` y `chainChanged` con `on`/`removeListener`.
- [x] `eth_requestAccounts` solo tras estar en la cadena correcta (o en misma cadena).
- [x] Flujo: intentar `wallet_switchEthereumChain` primero; si 4902, `wallet_addEthereumChain` y luego `wallet_switchEthereumChain`.
- [x] `chainId` siempre en hex string (EIP-695).
- [x] No llamar a `wallet_addEthereumChain` cuando `rpcUrls` esté vacío; mostrar error y log.
- [x] Tras add, llamar siempre a `wallet_switchEthereumChain` antes de considerar “conectado”.
- [x] Logs en consola: info siempre en init y Connect/switch; detallados con `window.DriveWalletWidget.debug === true`.
- [x] Descubrimiento EIP-6963: listener `eip6963:announceProvider`, dispatch `eip6963:requestProvider`; provider preferido vía EIP-6963, fallback a `window.ethereum`.

---

## Cambios aplicados tras esta auditoría

1. Validar `rpcUrls.length > 0` antes de `wallet_addEthereumChain`; si no, error claro y log.
2. Añadir logs informativos y de warning en puntos clave (inicio, connect, switch, add, requestAccounts, errores) controlados por un flag de depuración.
3. Mantener el flujo actual alineado con este documento; sin lógica improvisada fuera de las EIP y la guía de MetaMask.
4. **EIP-6963**: Descubrimiento de provider vía `eip6963:announceProvider` y `eip6963:requestProvider`; preferir provider MetaMask anunciado por EIP-6963; fallback a `window.ethereum`. Recomendación oficial de MetaMask para evitar conflictos y problemas con SES/lockdown.

**Logs:** Siempre se muestra en consola un mensaje al cargar el widget y al hacer clic en Connect / al solicitar el switch. Con `window.DriveWalletWidget = { debug: true }` antes de cargar el script se activan logs detallados de todo el flujo.

---

## SES / lockdown (entornos endurecidos)

En páginas que ejecutan **SES** o **lockdown** (p. ej. `lockdown-install.js`, "SES Removing unpermitted intrinsics"), el `window.ethereum` inyectado por MetaMask puede quedar roto: las llamadas RPC se "resuelven" en la página sin llegar a la extensión (p. ej. `wallet_switchEthereumChain` resuelve en ~4 ms sin popup ni cambio de red). **Causa raíz:** el hardening congela/proxea objetos y puede romper el canal postMessage con la extensión.

**Flujo recomendado en esos entornos:**
1. Llamar a **`eth_requestAccounts` primero** para "activar" el provider y establecer el canal con la extensión.
2. Luego comprobar `eth_chainId` y, si no es la red deseada, llamar a `wallet_switchEthereumChain` (o add + switch si 4902).
3. Verificar de nuevo con `eth_chainId` antes de dar por conectado.

El widget sigue este orden cuando el usuario hace clic en Connect. **Además:** cargar el script del widget **antes** de `lockdown()` en la página reduce la interferencia; si es posible, no ejecutar lockdown sobre el mismo contexto donde está `window.ethereum`.

### Si el widget marca "conectado" pero MetaMask sigue en otra red

En entornos con SES/lockdown, el provider puede devolver "éxito" y `eth_chainId` con la red deseada **sin que la extensión haya cambiado realmente**. El widget no puede distinguir esa situación.

**Opciones:**

1. **Cargar el script del widget antes de lockdown**  
   En el HTML, incluir `wallet-connect.js` (y, si aplica, el script que define el botón/contenedor) **antes** de `lockdown-install.js` o cualquier script que llame a `lockdown()`. Así `window.ethereum` queda intacto cuando el widget se ejecuta.

2. **Cambiar de red a mano en MetaMask**  
   El usuario abre MetaMask, elige la red correcta (p. ej. Infinite Drive Mainnet) y vuelve a la página. El widget ya mostrará estado coherente con esa red (p. ej. tras recargar o al recibir `chainChanged`).

3. **No usar lockdown en la página que integra el wallet**  
   Si la arquitectura lo permite, ejecutar SES/lockdown solo en otro iframe o worker y dejar la página principal sin endurecer, para que el provider inyectado funcione con normalidad.

4. **Usar el provider vía EIP-6963 (implementado en el widget)**  
   MetaMask recomienda EIP-6963 como mecanismo de conexión. El widget obtiene el provider mediante `eip6963:announceProvider` y lo usa para todas las llamadas RPC. En páginas donde **SES/lockdown ya se ha ejecutado antes** de que el provider sea usado, las llamadas RPC pueden seguir sin llegar realmente a la extensión (p. ej. `eth_chainId` devuelve la red “deseada” y `wallet_switchEthereumChain` resuelve sin popup). EIP-6963 no evita ese fallo cuando el **contexto de ejecución** (la página) está endurecido. No hay en la documentación de MetaMask ni en las EIP ningún truco de orden o formato que "fuerce" el popup en ese caso.

5. **Solución recomendada cuando SES/lockdown es obligatorio en la página**  
   Cargar el **widget de wallet en un iframe** cuyo documento **no** cargue SES/lockdown. La página padre puede seguir usando lockdown; el iframe tiene su propio `window` y, si no se endurece, el provider inyectado (o anunciado por EIP-6963) funcionará con normalidad. Es una decisión de arquitectura (dónde corre el script), no un workaround en código; el widget sigue usando solo las APIs documentadas (EIP-6963, 1193, 3326, 3085, 1102).  
   **Ejemplo:** la página con SES incluye `<iframe src="/widgets/wallet-connect/embed-wallet.html"></iframe>`. El documento `embed-wallet.html` solo carga el widget (sin lockdown), por lo que el cambio de red y el popup de MetaMask funcionan. Ver `embed-wallet.html` en este directorio.

Al conectar, el widget escribe en consola un mensaje recordando que, si la red en el wallet no coincide, se puede cambiar manualmente o usar un iframe sin lockdown para el widget.
