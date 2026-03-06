# Análisis: bloqueo de la interfaz de MetaMask con el widget conectado

## Síntoma

Cuando el usuario está conectado a MetaMask desde nuestra página del widget, la interfaz de MetaMask deja de responder (no se abre, no responde). Al ir a otra página y recargar MetaMask vuelve a funcionar; al regresar a nuestra página, MetaMask se bloquea de nuevo.

## Causa identificada: cascada de refrescos en el Bridge

### Flujo actual (problemático)

1. **Core** actualiza estado y notifica: `_onStateChange(getState())`. Esto ocurre en muchos puntos:
   - Tras `refreshNativeBalance()` (al completar `eth_getBalance`)
   - Tras `refreshTokenBalances()` (al completar los `eth_call` de cada token)
   - Tras `accountsChanged` / `chainChanged`
   - Tras conectar, desconectar, restaurar sesión, etc.

2. **Bridge** tiene registrado `onStateChange`. Cada vez que se invoca:
   - Si `stateSnapshot.connected === true`, hace **siempre**:
     - `core.refreshNativeBalance()`
     - `core.refreshTokenBalances(coreConfig)`

3. **Efecto**:  
   - `refreshNativeBalance()` termina → Core llama `_onStateChange(getState())` → Bridge ejecuta de nuevo `refreshNativeBalance()` y `refreshTokenBalances()`.  
   - Cuando cualquiera de esos refrescos termina, Core vuelve a llamar `_onStateChange(getState())` → Bridge vuelve a lanzar los mismos refrescos.  
   - Se genera una **cadena continua** de peticiones al provider: `eth_getBalance` y múltiples `eth_call` (4 por token ERC-20), una y otra vez.

4. **Consecuencia**:  
   El provider (MetaMask) recibe muchas solicitudes RPC en poco tiempo. La extensión usa un canal de mensajes (postMessage) con la página; saturar ese canal o la cola interna de MetaMask puede dejar la UI de la extensión bloqueada o sin poder abrir el popup.

### Qué no es la causa (en nuestro código)

- No hay `setInterval` ni polling en el widget (ya se eliminó el poll de red).
- Los listeners `accountsChanged` y `chainChanged` están bien: solo reaccionan a eventos del provider y hacen un refresco puntual.
- El `setInterval(showState, 2000)` del demo solo lee `window.DriveWallet` y no llama al provider.

## Solución aplicada

- **Responsabilidad única de refresco en el Core**:  
  El Core ya refresca balances en los momentos correctos:
  - Al conectar (`setStateFromAccounts`): `refreshNativeBalance()`
  - Al restaurar sesión en `start()`: `refreshNativeBalance()`
  - En `accountsChanged`: `refreshNativeBalance()` y `refreshTokenBalances()`
  - En `chainChanged`: `refreshNativeBalance()` y `refreshTokenBalances()`

- **Bridge solo re-renderiza**:  
  El Bridge no debe lanzar refrescos en cada `onStateChange`. Se han eliminado del Bridge las llamadas a `core.refreshNativeBalance()` y `core.refreshTokenBalances(coreConfig)` dentro de:
  - el callback `onStateChange` de `core.init()`
  - el callback `onReady` de `core.start()`

Así, cada cambio de estado solo pinta la UI con el estado actual; no se disparan nuevas rondas de peticiones al provider y se evita la cascada que bloqueaba MetaMask.

## Recomendación adicional

Si en el futuro se necesita refrescar balances desde fuera del Core (por ejemplo, un botón “Actualizar”), hacerlo con una sola llamada puntual (p. ej. `core.refreshNativeBalance()` y/o `core.refreshTokenBalances()`), nunca desde un listener que se ejecute en cada cambio de estado.
