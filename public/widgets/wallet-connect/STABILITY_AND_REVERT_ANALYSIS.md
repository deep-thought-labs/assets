# Análisis: estabilidad y restablecimiento del flujo Connect/Disconnect

## Situación actual

1. **Problema original (cambio de red):** Se creyó que el widget no cambiaba la red en MetaMask. Tras pruebas y revisión con otros modelos se concluyó que es muy probablemente un tema de **MetaMask/entorno (SES)**, no de nuestra implementación. En la práctica, la red que se muestra, el saldo y la dirección **sí coinciden** con lo que el usuario ve en MetaMask.

2. **Problema nuevo (desconexión):** Tras las modificaciones hechas para “forzar” el cambio de red, el botón **Desconectar** dejó de reflejar el estado desconectado en la UI: el usuario hace clic y la pantalla sigue en “conectado”.

3. **Objetivo:** Volver a un **flujo estable** donde Connect/Disconnect funcionen correctamente, **manteniendo**:
   - Listado de tokens (ERC-20) y sus saldos.
   - Detección automática de cambios en MetaMask (accountsChanged / chainChanged) para actualizar dirección, red y tokens.

---

## Cambios que se hicieron para el “cambio de red” (y que podemos simplificar)

| Cambio | Propósito | Impacto en disconnect / complejidad |
|--------|-----------|-------------------------------------|
| **Confirmación solo vía `chainChanged`** | No marcar conectado hasta recibir el evento (o fallback 600 ms) para evitar desincronización en SES. | Flujo de connect más complejo (Promise + timeout + listener temporal). Más superficie para fallos. |
| **Sin early-return por `eth_chainId`** | Evitar “already on target chain” cuando el provider en SES “miente”. | Siempre se hace switch; en entornos normales podría ser redundante. |
| **Polling cada 3 s** en `setupProviderEvents` | Detectar cambio de red si `chainChanged` no llega (SES). | Añade un `setInterval` mientras se está conectado; hay que limpiarlo en `removeProviderEvents`. Si algo falla al limpiar o al quitar listeners, el estado puede quedar raro. |
| **Try/catch en `disconnect` y en el clic** | Evitar que un error en `removeProviderEvents` (p. ej. en SES) impida limpiar estado. | Defensivo; no debería empeorar desconexión. |
| **Re-render explícito en el Bridge** al hacer clic en Disconnect | Mostrar el botón Connect aunque falle algo en el flujo de `onStateChange`. | Refuerza la UI; conviene mantener. |

**Hipótesis:** La combinación de **polling** + **listeners** + **flujo de connect basado en `chainChanged`** aumenta la complejidad y las referencias al provider/estado. En entornos con SES o con proxies, eso puede hacer que al desconectar algo no se limpie bien (p. ej. el intervalo o el estado que ve el Bridge), y la UI siga mostrando “conectado”.

---

## Qué mantener (ventajas actuales)

- **EIP-6963:** Descubrimiento del provider; recomendado por MetaMask; sin invasión extra.
- **Tokens:** `tokenContracts`, `refreshTokenBalances`, `tokenBalances` en estado y en UI, lectura ERC-20 (name/symbol/decimals/balance).
- **Eventos del provider:** `accountsChanged` y `chainChanged` en `setupProviderEvents` para actualizar estado y, si hay tokenContracts, llamar a `refreshTokenBalances`. Así se detectan cambios de cuenta y de red en MetaMask sin polling.
- **Sesión y restauración:** Lógica actual de `sessionStorage` y restore al cargar.
- **Try/catch en `disconnect`** y **re-render explícito** en el Bridge al hacer clic en Desconectar.

---

## Qué revertir o simplificar

1. **Flujo de connect (`ensureChainThenSetState`):**  
   Volver al flujo **simple** que ya teníamos y que era estable:
   - `eth_requestAccounts`.
   - `eth_chainId`: si ya coincide con la red objetivo → `setStateFromAccounts` y listo.
   - Si no coincide → `wallet_switchEthereumChain` (o add + switch si 4902).
   - Verificar de nuevo con `eth_chainId` y, si coincide, `setStateFromAccounts`.  
   Así se elimina la Promise con timeout, el listener temporal de `chainChanged` y el fallback de 600 ms dentro del connect.

2. **Polling de red:**  
   **Quitar** el `setInterval` de 3 s en `setupProviderEvents`. La actualización al cambiar de red en MetaMask se sigue haciendo solo con el evento **`chainChanged`** (y, si cambia la cuenta, con **`accountsChanged`** + `refreshTokenBalances`). Menos lógica y menos referencias activas al conectar/desconectar.

Con esto el flujo de connect vuelve a ser el clásico (requestAccounts → switch/add si hace falta → verificación con `eth_chainId`), y la desconexión deja de depender de limpiar un intervalo y de un flujo de connect más complejo. Los tokens y la detección automática de cambios en MetaMask se mantienen.

---

## Resumen del plan

- **Mantener:** EIP-6963, tokens (config + UI + refresh), listeners `accountsChanged`/`chainChanged` (sin poll), try/catch en disconnect, re-render explícito en el Bridge al clic en Desconectar.
- **Revertir/simplificar:**  
  - Connect: flujo simple con early-return por `eth_chainId` y verificación tras switch con `eth_chainId`.  
  - Eliminar el polling de 3 s en `setupProviderEvents`.

Esto deja el sistema en un punto estable: conexión/desconexión claras y predecibles, con las ventajas de listado de tokens y de refresco automático ante cambios en MetaMask.
