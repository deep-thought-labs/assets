# Plan de evolución del widget Wallet Connect (estilo Uniswap)

Este plan lleva el widget de **wallet-connect** hacia el patrón trigger + panel y mejoras de UX/accesibilidad inspiradas en Uniswap, **sin romper** el contrato público (`window.DriveWallet`, `window.DriveWalletWidget`, callbacks, `refreshBalances`).

**Referencia de lógica (Core):** Las funciones esenciales de conexión, desconexión, cambio de red y actualización deben comportarse como las resuelve la interfaz de **Uniswap** (y las EIP + documentación de MetaMask). No priorizamos “rescatar” nuestra implementación actual si la referencia ya lo hace bien; el objetivo es **emular correctamente** ese comportamiento en nuestro Core (vanilla JS, EIP-1193), aunque no usemos su código (wagmi/React) directamente.

---

## Principios del plan

- **Referencia Core = Uniswap + EIPs + MetaMask:** Conectar, desconectar, cambiar red, solicitar cambio a nuestra red, actualizar balances y sesión se implementan siguiendo la misma lógica/comportamiento que la referencia. Donde nuestro Core difiera, lo cambiamos para alinearnos; no mantenemos nuestra versión por inercia.
- **Retrocompatibilidad:** El modo por defecto sigue siendo `inline`. Quien ya embebe el widget no tiene que cambiar nada.
- **Contrato estable:** No se modifican la forma de `window.DriveWallet`, los callbacks existentes ni el origen de datos (`network-data.json`).
- **Fases incrementales:** Cada fase es desplegable y probable por sí sola; las siguientes construyen sobre la anterior.
- **Un solo script:** La entrega sigue siendo `wallet-connect.js` (Core + UI + Bridge en un solo archivo).

---

## Resumen de fases

| Fase | Objetivo | Entregable |
|------|----------|------------|
| **Core** | Alinear la lógica del Core con Uniswap/EIPs/MetaMask | Connect, disconnect, switch/add chain, refresh, sesión y provider según referencia |
| **0** | Base: accesibilidad, estado "Connecting", nombres internos | Mejoras en modo inline; sin nuevo layout |
| **1** | Estado de UI del panel y API pública | `panelOpen`, `openPanel()` / `closePanel()` / `togglePanel()` |
| **2** | Layout dropdown (trigger + panel) | `data-layout="dropdown"`, click-outside, ref del trigger |
| **3** | Callbacks de panel, documentación y demo | `onPanelOpen` / `onPanelClose`, ARCHITECTURE/SPEC actualizados, demo dropdown |

---

## Fase Core — Misma lógica que la referencia (Uniswap / Ioni's Whip)

**Objetivo:** Que el **Core** del widget (conectar, desconectar, cambiar red, solicitar cambio a nuestra red, actualizar, sesión) haga **lo mismo** que la interfaz de Uniswap y lo que dictan las EIP y la documentación de MetaMask. No reutilizamos su código (ellos usan wagmi/React); sí **emulamos su comportamiento** en nuestro Core vanilla. Si nuestra implementación actual difiere y la referencia está bien, **cambiamos la nuestra**, no la conservamos por ser “nuestra”.

*(Si “Ioni's Whip” es un producto o lib distinto a Uniswap, se sustituye aquí por esa referencia; el principio es el mismo: una referencia única para la lógica esencial.)*

### Core.1 Referencia explícita y auditoría

- **Qué:** Documentar en un único sitio (p. ej. `CORE_REFERENCE.md` o sección en `WALLET_CONNECT_OFFICIAL_AUDIT.md`) que la **referencia de verdad** para la lógica del Core es:
  - Comportamiento observable de la interfaz web de Uniswap (connect, disconnect, switch chain, add chain, refresh, sesión).
  - EIP-1193, EIP-1102, EIP-3326, EIP-3085, EIP-6963 y documentación oficial de MetaMask (add/switch network, EIP-6963).
- **Auditoría:** Listado ítem a ítem: flujo de connect, flujo de disconnect, flujo de cambio de red (switch/add), refresh de balances, restauración de sesión, descubrimiento de provider (EIP-6963 + fallback). Para cada ítem: “qué hace la referencia” y “qué hace nuestro Core hoy”. Marcar coincidencias y diferencias.
- **Criterio de aceptación:** Cualquier desarrollador puede ver qué debe hacer el Core y en qué puntos nuestro código ya coincide o aún no.

### Core.2 Connect (y solicitud de cambio a nuestra red)

- **Referencia:** En Uniswap (vía wagmi) se usa un flujo tipo: conectar connector → si hace falta, cambiar de cadena (`switchChain`); si la cadena no existe (4902), add + switch. La confirmación de “estamos en la red correcta” viene del estado del provider (y en nuestro caso, según auditoría, debe apoyarse en el evento `chainChanged` o en un fallback controlado, no solo en un `eth_chainId` previo para evitar SES/desincronización).
- **Qué hacer:** Asegurar que nuestro Core hace:
  - Orden: `eth_requestAccounts` primero (activar provider / popup), luego asegurar cadena: `eth_chainId` actual; si no es la nuestra, `wallet_switchEthereumChain`; si 4902, `wallet_addEthereumChain` (con `rpcUrls` no vacío) y luego `wallet_switchEthereumChain`.
  - No confiar en un `eth_chainId` previo para saltar el switch (evitar “already on target chain” sin confirmación real).
  - Considerar “conectado a nuestra red” solo cuando (a) recibimos `chainChanged` con la chainId objetivo, o (b) un fallback controlado (p. ej. 600 ms) comprueba `eth_chainId` tras el switch si el wallet no emitió evento. Timeout (p. ej. 5 s) si no hay confirmación; no marcar conectado.
- **Criterio de aceptación:** El flujo de connect y de “solicitar cambio a nuestra red” es equivalente al de la referencia; no hay diferencias conocidas que dejen peor al usuario (SES, desincronización, 4902 mal manejado).

### Core.3 Disconnect

- **Referencia:** En Uniswap, disconnect limpia estado de la app (cuentas, chain) y cierra la sesión local; no llama a un método EIP-1193 “disconnect” (no está estandarizado así en el provider).
- **Qué hacer:** Nuestro Core ya hace: quitar listeners del provider, limpiar estado, limpiar sesión, sincronizar `window.DriveWallet` y llamar a `onDisconnect`. Verificar que no quede ningún comportamiento distinto a la referencia (p. ej. no intentar llamar a algo tipo `provider.disconnect()` si la referencia no lo hace).
- **Criterio de aceptación:** Comportamiento de disconnect alineado con la referencia; estado y sesión limpios; callbacks y `window.DriveWallet` actualizados.

### Core.4 Cambio de red (usuario cambió en el wallet)

- **Referencia:** Escuchar `chainChanged` (EIP-1193); actualizar estado (chainId, networkName si aplica); opcionalmente ofrecer al usuario volver a “nuestra” red (equivalente a “solicitar cambio a nuestra red”).
- **Qué hacer:** Mantener/asegurar: listener `chainChanged` actualiza estado, `syncDriveWallet`, callbacks `onChainChanged`, y si mostramos red en la UI, reflejar la nueva. No marcar “desconectado” solo por cambiar de red; solo al `accountsChanged` vacío o al disconnect explícito.
- **Criterio de aceptación:** Cambio de red en el wallet se refleja en estado y UI; opción de “volver a nuestra red” usa el mismo flujo que Core.2 (switch/add).

### Core.5 Actualizar balances (refresh)

- **Referencia:** Tras connect o tras cambio de cuenta/cadena, refrescar balances (nativo + tokens configurados); el implementador puede forzar refresh con `refreshBalances()`.
- **Qué hacer:** Asegurar que `refreshNativeBalance` y `refreshTokenBalances` se llaman en los mismos momentos que en la referencia (tras connect, tras `accountsChanged`, tras `chainChanged`) y que `window.DriveWalletWidget.refreshBalances()` ejecuta la misma lógica. No añadir fuentes de verdad distintas (p. ej. cachés que contradigan al provider).
- **Criterio de aceptación:** Refresh automático y manual coherentes con la referencia; `window.DriveWallet` actualizado tras refresh.

### Core.6 Sesión y restauración

- **Referencia:** Uniswap (y muchas apps) restauran “conectado” si al cargar la página el wallet sigue con las mismas cuentas y la misma cadena (o la cadena deseada). No abrir popup en load sin interacción del usuario.
- **Qué hacer:** Nuestro Core ya tiene: sesión en `sessionStorage`, restauración solo si misma red + `eth_accounts` con cuentas + `eth_chainId` coincide. Si la cadena no coincide, no restaurar y mostrar botón Connect (usuario debe hacer switch/add explícito). No llamar a `eth_requestAccounts` en el arranque.
- **Criterio de aceptación:** Restauración solo cuando la referencia también consideraría “siguen conectados”; sin popups en load.

### Core.7 Provider (EIP-6963 + fallback)

- **Referencia:** MetaMask recomienda EIP-6963; muchas apps tienen fallback a `window.ethereum` para compatibilidad.
- **Qué hacer:** Mantener: escuchar `eip6963:announceProvider` / `eip6963:requestProvider`; preferir MetaMask por rdns/nombre; si no hay ninguno por EIP-6963, fallback a `window.ethereum` (array: preferir isMetaMask o primero). No depender solo de EIP-6963 si queremos máxima compatibilidad.
- **Criterio de aceptación:** Misma política de descubrimiento que la referencia; sin regresiones en entornos solo con `window.ethereum`.

### Orden recomendado para la Fase Core

1. Core.1 (referencia + auditoría).
2. Core.2 y Core.3 (connect y disconnect).
3. Core.4, Core.5, Core.6, Core.7 (switch/chainChanged, refresh, sesión, provider).

La Fase Core puede hacerse **antes** de la Fase 0 (así la UI se construye sobre un Core ya alineado) o en paralelo si se prioriza solo UI al principio; en cualquier caso, la intención es que **sí** esté contemplado usar la misma lógica (o la más aproximada) que Uniswap para todo lo esencial.

---

## Fase 0 — Base (sin nuevo layout)

**Objetivo:** Mejorar el modo actual (inline) con accesibilidad, estado "Connecting" y una estructura interna clara (TriggerView / PanelView) sin cambiar el comportamiento visible para el implementador.

### 0.1 Estado "Connecting…" en la UI

- **Qué:** Durante la ejecución de `connect()` (desde el primer `eth_requestAccounts` hasta que se confirma la red o falla), la UI debe mostrar un estado explícito "Connecting…" (y opcionalmente un indicador de carga), en lugar de dejar el botón "Connect" sin feedback.
- **Dónde:** Bridge mantiene un flag `isConnecting` (true al entrar en `connect()`, false al terminar —éxito o error—). La UI (renderReady / flujo que pinta el botón) recibe ese flag y, si es true, pinta una vista `renderConnecting(container, uiConfig)` en lugar del botón.
- **Detalle:** Core no necesita cambiar. El Bridge puede pasar a `connect()` un wrapper que setea `isConnecting = true`, llama a `core.connect(...)` y en el `.then`/`.catch` pone `isConnecting = false` y vuelve a pasar estado a `onStateChange` (o re-render explícito).
- **Criterio de aceptación:** Al hacer clic en "Connect", aparece "Connecting…" (y si se quiere un spinner) hasta que se abre MetaMask o falla; no se puede disparar un segundo connect mientras tanto (botón deshabilitado o no clicable).

### 0.2 Accesibilidad (modo inline)

- **Qué:** Añadir atributos y teclado para que el widget sea usable con teclado y lectores de pantalla.
- **Cambios:**
  - Botón "Connect": `role="button"`, `aria-label` con el texto del botón (o `data-button-label`), `tabindex="0"`. En el handler del botón, aceptar también `keydown` con tecla `Enter` o `Space` (preventDefault y llamar a la misma acción que el click).
  - Barra conectada: el área de "Disconnect" con `role="button"` y `aria-label="Desconectar"` (o texto configurable). Soporte de Enter/Space igual.
  - Link "Refresh": `role="button"`, `aria-label="Actualizar balances"`, Enter/Space.
  - Contenedor raíz: si tiene un rol semántico (p.ej. región), `aria-label` breve ("Wallet Connect" o "Estado de conexión de wallet").
- **Criterio de aceptación:** Se puede conectar y desconectar solo con teclado; un lector de pantalla anuncia correctamente el botón y la acción de desconectar.

### 0.3 Refactor interno: TriggerView y PanelView (solo nombres y estructura)

- **Qué:** Dentro de la capa UI, separar conceptualmente (y en funciones) lo que pinta el "trigger" (botón o pill) y lo que pinta el "contenido" (lo que hoy es la barra conectada o el botón Connect). En modo inline, "trigger" y "panel" se pintan en el mismo contenedor y no hay dropdown.
- **Cómo:**
  - Extraer `renderTriggerInline(state, uiConfig, chainParams, isConnecting, onConnect)` → pinta botón "Connect" o pill (dirección + red corta). Si hay `isConnecting`, puede delegar en algo como `renderConnecting(...)`.
  - Extraer `renderPanelContent(state, uiConfig, chainParams, onConnect, onDisconnect, onRefresh)` → pinta el contenido que hoy está en `renderReady` (solo el botón) o en `renderConnected` (barra con address, red, refresh, disconnect).
  - En modo inline, Bridge sigue llamando a una sola función que combina trigger y contenido (como ahora), pero esa función usa por dentro `renderTriggerInline` y `renderPanelContent` para no duplicar markup y estilos. Los nombres quedan listos para la Fase 2, donde el trigger irá en un nodo y el panel en otro.
- **Criterio de aceptación:** Comportamiento visual idéntico al actual; solo cambia la organización del código y los nombres de las funciones de render.

### 0.4 Documentación interna

- **Qué:** En comentarios al inicio de `wallet-connect.js` (o en ARCHITECTURE.md) documentar la separación TriggerView / PanelView y que en modo `inline` ambos se montan en el mismo contenedor.
- **Criterio de aceptación:** Cualquier desarrollador que lea el código entiende que hay "vista trigger" y "vista contenido del panel" y que el layout dropdown (Fase 2) reutiliza esas vistas.

---

## Fase 1 — Estado de UI del panel y API pública

**Objetivo:** Introducir el estado "panel abierto/cerrado" y exponer `openPanel()`, `closePanel()`, `togglePanel()` en `window.DriveWalletWidget`, de forma que en modo inline no cambie el comportamiento (el "panel" está siempre visible), pero la API esté disponible para el modo dropdown.

### 1.1 Estado interno `panelOpen`

- **Qué:** Bridge mantiene una variable (por instancia de widget/contenedor) `panelOpen` (boolean). Por defecto en modo `inline` puede ignorarse (siempre "abierto" para efectos de qué se pinta). En modo `dropdown` (Fase 2) será true/false según clics y click-outside.
- **Dónde:** Dentro del closure del Bridge (donde está `run()`, `chainParamsRef`, etc.). Si hay varios contenedores, puede ser un objeto por contenedor o una sola variable si solo hay un dropdown a la vez.
- **Criterio de aceptación:** El estado existe y puede ser leído/escrito desde funciones que luego implementarán open/close/toggle y el dropdown.

### 1.2 API pública: `openPanel()`, `closePanel()`, `togglePanel()`

- **Qué:** Tras inicializar el widget, `window.DriveWalletWidget` debe tener:
  - `openPanel()`: pone `panelOpen = true` y re-renderiza (en modo dropdown mostrará el panel; en inline no tiene efecto visual).
  - `closePanel()`: pone `panelOpen = false` y re-renderiza.
  - `togglePanel()`: invierte `panelOpen` y re-renderiza.
- **Implementación:** El Bridge, después de `core.start(...)` (o en el callback onReady), asigna estas tres funciones a `window.DriveWalletWidget`. Cada una actualiza `panelOpen` y llama a la misma lógica de re-render que ya usa `onStateChange` (p. ej. una función `renderAll()` que pinta según estado del Core + `panelOpen` + layout).
- **Criterio de aceptación:** Desde la consola, `window.DriveWalletWidget.openPanel()` / `closePanel()` / `togglePanel()` no dan error. En modo inline no se nota cambio visual; en Fase 2, con dropdown, abrirán/cerrarán el panel.

### 1.3 Configuración del layout

- **Qué:** Añadir opción de config `layout`: valores `inline` (por defecto) o `dropdown`. Origen: atributo `data-layout` en el contenedor o en el script, o `window.DriveWalletWidget.layout`.
- **Dónde:** En `getConfig()` del Bridge, leer `layout` y normalizarlo a `'inline'` o `'dropdown'`; si no está definido, `'inline'`.
- **Criterio de aceptación:** Con `data-layout="inline"` (o sin atributo) el widget se comporta como hoy. Con `data-layout="dropdown"` se usará en Fase 2 para mostrar trigger + panel; en Fase 1 solo se guarda el valor y se usa en la lógica de open/close (en inline, open/close no cambian qué se ve).

---

## Fase 2 — Layout dropdown (trigger + panel)

**Objetivo:** Cuando `layout === 'dropdown'`, mostrar un trigger (botón o pill) que al hacer clic abre/cierra un panel flotante; el panel contiene el mismo contenido que hoy (Connect o barra conectada). Click fuera del panel (pero no en el trigger) y Escape cierran el panel.

### 2.1 Estructura DOM para dropdown

- **Qué:** En modo dropdown, el contenedor del widget debe tener:
  - Un nodo "trigger": botón (si no conectado) o pill con dirección truncada + icono/red (si conectado). Un solo clic en el trigger → toggle del panel (no ejecuta connect ni disconnect).
  - Un nodo "panel": contenedor posicionado (absolute/fixed) debajo o al lado del trigger, con el contenido actual: si no conectado, botón "Connect"; si conectado, dirección completa, red, Refresh, Disconnect.
- **Implementación:** Reutilizar `renderTriggerInline` para el trigger (pero sin llamar a `onConnect` en el clic; en su lugar llamar a `togglePanel()`). Reutilizar `renderPanelContent` para el contenido del panel. El Bridge pinta primero el trigger dentro del container y luego, si `panelOpen`, añade un div (o usa un portal lógico si todo es mismo documento) para el panel, posicionado respecto al trigger. Estilos nuevos (clases con el mismo prefijo `drive-wc-`) para el panel: sombra, borde, border-radius, z-index alto.

### 2.2 Posicionamiento del panel

- **Qué:** El panel debe aparecer debajo del trigger (o arriba si no hay espacio), alineado por un borde (p. ej. borde derecho del trigger = borde derecho del panel para alineación tipo navbar). Usar `getBoundingClientRect()` del trigger y posición fixed o absolute con top/left (o bottom/right) calculados.
- **Criterio de aceptación:** En desktop y móvil el panel no se sale de la ventana (o se ajusta con lógica mínima); se ve claramente como "menú desplegable" del trigger.

### 2.3 Click-outside y ref del trigger

- **Qué:** Clic fuera del panel debe cerrar el panel. Clic **en el trigger** no debe cerrar el panel (debe hacer toggle: si estaba abierto, se cierra; si estaba cerrado, se abre). Es decir, el trigger no debe considerarse "outside" del widget a efectos de cerrar.
- **Implementación:** Añadir un listener `click` en `document` (o en un overlay opcional) que compruebe si el `event.target` está dentro del panel o dentro del nodo del trigger. Si está fuera de ambos (o solo fuera del panel y no en el trigger), llamar a `closePanel()`. Guardar referencias al elemento trigger y al elemento panel para las comprobaciones. Al destruir el widget (si en el futuro se soporta), quitar el listener.
- **Criterio de aceptación:** Abrir panel → clic en el trigger → panel se cierra. Abrir panel → clic en la página (fuera del trigger y del panel) → panel se cierra. No se cierra con clic dentro del panel.

### 2.4 Cerrar con Escape

- **Qué:** Tecla Escape cierra el panel si está abierto.
- **Implementación:** Listener `keydown` en `document` (o en el contenedor del widget). Si `event.key === 'Escape'` y `panelOpen`, llamar a `closePanel()`.
- **Criterio de aceptación:** Panel abierto → Escape → panel se cierra.

### 2.5 Estado "Connecting" en modo dropdown

- **Qué:** Durante "Connecting…", el panel puede mostrar el mensaje "Connecting…" (y el trigger puede mostrar un indicador de carga opcional). No cerrar el panel automáticamente al iniciar connect; el usuario puede cerrarlo manualmente si quiere.
- **Criterio de aceptación:** Mismo comportamiento que en Fase 0 para el estado Connecting, pero dentro del panel cuando layout es dropdown.

### 2.6 Cerrar panel tras disconnect (opcional)

- **Qué:** Decisión de producto: al hacer "Disconnect" dentro del panel, ¿el panel se cierra solo? Recomendación: sí, para parecerse a Uniswap (tras desconectar, el drawer se cierra).
- **Implementación:** En el callback que ejecuta `core.disconnect(coreConfig)`, después de desconectar llamar a `closePanel()`.
- **Criterio de aceptación:** Usuario conectado, panel abierto → Disconnect → panel se cierra y el trigger pasa a mostrar "Connect".

---

## Fase 3 — Callbacks de panel, documentación y demo

**Objetivo:** Exponer callbacks opcionales para el panel, actualizar SPEC y ARCHITECTURE, y añadir una demo del modo dropdown.

### 3.1 Callbacks `onPanelOpen` y `onPanelClose`

- **Qué:** En `window.DriveWalletWidget` se pueden definir (opcional) `onPanelOpen` y `onPanelClose`. El widget los invoca sin argumentos cuando el panel se abre o se cierra (por cualquier motivo: clic en trigger, click-outside, Escape, o tras disconnect).
- **Dónde:** En `getConfig()` ya se leen los callbacks; añadir estas dos propiedades y en el Bridge llamarlas al abrir y al cerrar el panel (solo si están definidas).
- **Criterio de aceptación:** Implementador define `window.DriveWalletWidget.onPanelOpen = function() { ... }` y comprueba que se ejecuta al abrir el panel; igual con `onPanelClose`.

### 3.2 Actualización de SPECIFICATION.md

- **Qué:** Documentar en la spec:
  - Nueva opción de config: `layout` (`inline` | `dropdown`), y dónde se puede setear (data attribute, global).
  - Nuevos métodos: `openPanel()`, `closePanel()`, `togglePanel()`.
  - Nuevos callbacks: `onPanelOpen`, `onPanelClose`.
  - Comportamiento del modo dropdown: trigger vs panel, click-outside, Escape.
- **Criterio de aceptación:** Un implementador que solo lea la spec puede usar el modo dropdown y la API del panel sin leer el código.

### 3.3 Actualización de ARCHITECTURE.md

- **Qué:** Añadir una sección "Layouts" que describa:
  - Modo inline: trigger y contenido en el mismo bloque (comportamiento actual).
  - Modo dropdown: trigger + panel flotante; estado `panelOpen`; ref del trigger para click-outside.
  - Diagrama de flujo o tabla de "qué se pinta dónde" según layout y estado (conectado / no conectado / connecting).
- **Criterio de aceptación:** La arquitectura TriggerView / PanelView y el estado de UI del panel quedan explicados para futuros mantenedores.

### 3.4 Demo dropdown en demo.html

- **Qué:** En `demo.html` (o en una segunda página `demo-dropdown.html`), añadir un segundo ejemplo del widget con `data-layout="dropdown"` y las mismas opciones (theme, network, button label). Mostrar el código a copiar para el modo dropdown.
- **Criterio de aceptación:** El implementador puede probar el dropdown en la demo y copiar el snippet para su sitio.

### 3.5 Clases CSS estables para el panel (spec)

- **Qué:** Si se añaden nuevas clases para el panel (p. ej. `.drive-wc-panel`, `.drive-wc-trigger`), documentarlas en la sección de "Class naming" de la spec para que quien use `data-styles="custom"` pueda estilizar el dropdown sin depender de nombres internos no documentados.
- **Criterio de aceptación:** Spec lista las clases del trigger y del panel con su propósito.

---

## Orden de implementación sugerido

1. **Fase Core** (Core.1 → Core.7). Referencia + auditoría; luego alinear connect, disconnect, switch/add chain, refresh, sesión y provider con Uniswap/EIPs/MetaMask. Merge cuando el Core se considere alineado; validar en los mismos escenarios que la referencia.
2. **Fase 0** completa (0.1 → 0.4). Merge y despliegue; validar que el widget actual no regresa.
3. **Fase 1** completa (1.1 → 1.3). Merge; comprobar que `openPanel`/`closePanel`/`togglePanel` existen y que `data-layout="dropdown"` se lee (aunque aún no cambie la UI).
4. **Fase 2** completa (2.1 → 2.6). Merge; probar dropdown en varias resoluciones y con teclado.
5. **Fase 3** completa (3.1 → 3.5). Merge; actualizar documentación y demo.

*(La Fase Core puede hacerse en paralelo a la Fase 0 si se quiere sacar antes la UI; lo importante es no dar por cerrado el plan sin haber alineado el Core con la referencia.)*

---

## No hacer (fuera de alcance de este plan)

- Cambiar la forma de `window.DriveWallet` ni los callbacks existentes (onReady, onConnect, onDisconnect, onError, onAccountsChanged, onChainChanged).
- Cambiar el origen de datos (`network-data.json`) ni la URL de red.
- Añadir dependencias (frameworks, librerías) ni dividir el widget en varios archivos para el embed.
- Soporte de múltiples wallets (selector de wallet tipo Uniswap); queda como posible evolución futura.

---

## Checklist final (antes de dar por cerrado el plan)

- [ ] **Fase Core:** Referencia documentada (Uniswap + EIPs + MetaMask); auditoría ítem a ítem; connect, disconnect, switch/add chain, refresh, sesión y provider alineados con la referencia (no conservar nuestra implementación donde la referencia ya lo hace bien).
- [ ] Fase 0: Connecting, a11y, refactor TriggerView/PanelView, docs internas.
- [ ] Fase 1: panelOpen, openPanel/closePanel/togglePanel, config layout.
- [x] Fase 2: DOM dropdown, posicionamiento, click-outside, Escape, cerrar al disconnect.
- [x] Fase 3: onPanelOpen/onPanelClose, SPEC y ARCHITECTURE actualizados, demo dropdown, clases CSS documentadas.
- [ ] Todas las integraciones existentes con `data-layout` por defecto (inline) siguen funcionando igual.
- [ ] `window.DriveWallet` y `window.DriveWalletWidget` (campos ya existentes) siguen siendo compatibles.
