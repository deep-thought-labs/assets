# Reporte actualizado para Grog — Cambio de red con MetaMask no efectivo

## Restricción importante

**Queremos basarnos exclusivamente en lo que está documentado oficialmente:** documentación de MetaMask, EIP-3326 (wallet_switchEthereumChain), EIP-3085 (wallet_addEthereumChain), EIP-1102 (eth_requestAccounts), EIP-1193 (Provider). Debemos evitar implementaciones personalizadas o “hacks”; la solución debe usar únicamente las APIs y flujos que la industria y la documentación oficial dictan.

---

## Objetivo

Widget Web3 que conecta a Infinite Drive (red EVM). Al hacer clic en “Connect” con la red mainnet seleccionada, el usuario debe poder conectarse **y** que MetaMask cambie a esa red. Es una funcionalidad básica y esencial en cualquier integración Web3.

---

## Flujo actual (según documentación)

Implementamos exactamente lo indicado en la documentación de MetaMask y las EIP:

1. **eth_requestAccounts** (EIP-1102) — primero, para establecer canal con la extensión (y por la sugerencia de “activar” el provider en entornos SES).
2. **eth_chainId** — solo para logging; no usamos el resultado para saltarnos el switch.
3. **wallet_switchEthereumChain** (EIP-3326) con `params: [{ chainId: "0x66c9a" }]` (hex string, mainnet).
4. Si el wallet devuelve **4902**, llamamos a **wallet_addEthereumChain** (EIP-3085) con `chainId`, `chainName`, `nativeCurrency`, `rpcUrls`, `blockExplorerUrls` desde nuestro `network-data.json`, luego **wallet_switchEthereumChain** de nuevo.
5. Verificación final con **eth_chainId**; solo si coincide con la red deseada marcamos como conectado y actualizamos estado.

Provider: `window.ethereum`; si es array, usamos el que tiene `isMetaMask === true`. Una sola extensión en las pruebas (`providersCount: 1`, `isMetaMask: true`).

---

## Síntomas actuales

- **eth_requestAccounts:** Funciona. Aparece el popup de MetaMask, el usuario aprueba, la promesa resuelve tras varios segundos (round-trip real con la extensión).
- **eth_chainId** (después de requestAccounts): Devuelve `"0x66c9a"` (mainnet) de forma inmediata.
- **wallet_switchEthereumChain:** Se llama con `params: [{ chainId: "0x66c9a" }]`. La promesa **resuelve en ~50 ms** (a veces ~4 ms). **No aparece el popup de MetaMask** para cambiar de red. En la UI de MetaMask la red sigue siendo **testnet**.
- **Verificación eth_chainId** (después del switch): Sigue devolviendo `"0x66c9a"`, por lo que el widget marca “conectado” a mainnet.
- **Resultado:** El widget muestra “conectado a mainnet” pero en MetaMask el usuario sigue en testnet. No hay cambio real de red en la extensión.

En la consola del navegador aparece **SES / lockdown** (“SES Removing unpermitted intrinsics”, “lockdown-install.js”). El script del widget se carga en la misma página que ese entorno (orden de scripts: probablemente lockdown antes o en paralelo con el resto).

---

## Lo que ya probamos (sin salir de la documentación)

- Llamar **wallet_switchEthereumChain primero** (flujo estándar MetaMask) → mismo comportamiento (resuelve sin popup).
- Llamar **eth_requestAccounts primero** y luego **wallet_switchEthereumChain** (para “activar” el provider) → requestAccounts sí muestra popup; switch sigue resolviendo en ~50 ms sin popup y sin cambio en MetaMask.
- **No** saltarnos el switch cuando eth_chainId ya coincide; **siempre** llamar wallet_switchEthereumChain.
- Verificar con **eth_chainId** después del switch; si no coincide, no marcar conectado y mostrar error. En nuestro caso eth_chainId siempre coincide (devuelve mainnet) aunque la UI de MetaMask siga en testnet.
- Preferir provider con **isMetaMask === true** cuando hay varios. Sigue siendo un solo provider en las pruebas.

No hemos introducido lógica propia fuera de lo que dicen las EIP y la documentación de MetaMask (sin proxies propios, sin reemplazar el provider, sin APIs no estándar).

---

## Preguntas concretas para Grog

1. **Dentro únicamente de las APIs documentadas (MetaMask + EIP-3326, 3085, 1102, 1193):** ¿existe algún flujo, orden de llamadas, formato de parámetros (p. ej. chainId en hex, mayúsculas/minúsculas) o condición (p. ej. “solo después de X”) que garantice o maximice que **wallet_switchEthereumChain** dispare el popup de cambio de red en MetaMask y que la extensión cambie realmente? ¿Algo que estemos pasando por alto en la documentación oficial?

2. **SES/lockdown en la misma página:** La documentación de MetaMask y las EIP no hablan de entornos endurecidos. Si el sitio **debe** ejecutar SES/lockdown (p. ej. `lockdown-install.js`), ¿hay alguna forma **oficial o recomendada** en la documentación de MetaMask, de Agoric/Endo o de EIP para que el provider inyectado siga siendo fiable para **wallet_switchEthereumChain** y **eth_chainId** (p. ej. orden de carga de scripts, uso de iframes, o uso de EIP-6963) sin implementar soluciones propietarias?

3. **EIP-6963 (provider discovery):** ¿Cambiar a **EIP-6963** para obtener el provider en lugar de `window.ethereum` podría evitar la interferencia de SES con el provider que usa MetaMask, y es eso algo que la documentación o las best practices actuales recomiendan para este tipo de problema?

Necesitamos una solución que siga dependiendo de la documentación oficial y de los estándares de la industria, sin “no se puede” como respuesta final: la funcionalidad (pedir cuentas + cambiar de red) es básica y debe ser achievable con las APIs estándar.
