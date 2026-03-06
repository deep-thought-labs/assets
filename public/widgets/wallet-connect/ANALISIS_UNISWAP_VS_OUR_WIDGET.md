# Análisis: Uniswap Interface vs Widget Infinite Drive

**Objetivo:** Estudiar cómo funciona el “widget” de conexión/desconexión de wallet en el repositorio oficial de Uniswap y compararlo con nuestro widget en `wallet-connect`, para acercar nuestra **estructura y arquitectura** a sus patrones sin perder nuestras personalizaciones (origen de datos, API pública para el implementador).

---

## 1. Cómo funciona el patrón de Uniswap (resumen)

En la interfaz web de Uniswap el “widget” de wallet no es un único componente: es la suma de **dos piezas** y un **estado de UI** separado del estado de conexión.

### 1.1 Trigger (entrada en la barra)

- **Componente:** `Web3Status` (`apps/web/src/components/Web3Status/index.tsx`).
- **Comportamiento:**
  - **Sin conectar:** muestra un botón (“Connect” / “Log in”) con `data-testid="navbar-connect-wallet"`.
  - **Conectando:** muestra estado de carga con identificador de cuenta.
  - **Conectado:** muestra icono de estado, dirección truncada y opcionalmente Unitag.
- **Acción:** Un solo gesto — al hacer clic se abre/cierra el **drawer** (panel desplegable). No abre directamente el flujo de conexión en el mismo elemento; abre el panel donde el usuario elige conectar o gestionar la cuenta.

### 1.2 Panel (drawer)

- **Componente:** `AccountDrawer` → `DefaultMenu` → **MainMenu**.
- **MainMenu** decide qué mostrar:
  - **No conectado:** `WalletModal` (lista de wallets para conectar).
  - **Conectado:** `AuthenticatedHeader` (balance, dirección, acciones, **DisconnectButton**).
- El drawer es un **dropdown/sheet** que se posiciona respecto al trigger (referencia compartida con `Web3StatusRef`) para no cerrarse al hacer clic en el botón.

### 1.3 Estado de UI vs estado de conexión

- **Conexión:** Store de cuentas (wagmi + store unificado), hooks como `useActiveAddresses()`, `useConnectionStatus()`.
- **UI del panel:** Estado aparte con **Jotai** — `accountDrawerOpenAtom` (abierto/cerrado). Hook `useAccountDrawer()` expone `open`, `close`, `toggle`.
- **Flujo:** Click en trigger → `accountDrawer.toggle()` → se abre el drawer → dentro del drawer el usuario ve “Connect” (WalletModal) o “Disectado” (AuthenticatedHeader + DisconnectButton).

### 1.4 Resumen del patrón Uniswap

| Capa | Responsabilidad |
|------|------------------|
| **Trigger** | Solo muestra: “Connect” o “Conectado (dirección + icono)”. Un solo clic = abrir/cerrar panel. |
| **Panel** | Contenido real: selector de wallet (si no conectado) o cabecera autenticada + disconnect (si conectado). |
| **Estado UI** | Abierto/cerrado del panel (Jotai). Independiente del estado “conectado / no conectado”. |
| **Estado conexión** | Wagmi + store; una sola fuente de verdad para address, chain, connector. |

No exportan nada al implementador: es una app interna. Nosotros sí tenemos contrato público (`window.DriveWallet`, callbacks).

---

## 2. Nuestro widget actual (wallet-connect)

### 2.1 Estructura (Core / UI / Bridge)

- **Core:** Lógica pura. Estado (`connected`, `address`, `chainId`, `chainIdHex`, `networkName`, `environment`, `provider`, `nativeToken`, `tokenBalances`). Session, provider (EIP-6963 + fallback), `start()`, `connect()`, `disconnect()`, `onStateChange`.
- **UI:** Solo presentación. `renderLoading`, `renderNoWallet`, `renderError`, `renderReady` (botón Connect), `renderConnected` (barra con dirección, red, refresh, disconnect). Temas base/light/dark.
- **Bridge:** Config (script + container + global), `forEachContainer`, llama a Core y en `onStateChange` re-renderiza con la capa UI.

### 2.2 Flujo actual

- **Una sola superficie:** Todo es inline en el contenedor. No hay “trigger” vs “panel”.
  - Desconectado: botón “Connect to Infinite Drive”.
  - Conectado: barra con dirección + red + Refresh + Disconnect.
- Estado de conexión y lo que se pinta van en paralelo: mismo estado, misma vista. No hay estado de “panel abierto/cerrado” porque no hay panel.

### 2.3 Contrato público (lo que debemos mantener)

- **Estado:** `window.DriveWallet` (connected, address, chainId, chainIdHex, networkName, environment, provider, nativeToken, tokens/tokenBalances) y `toJSON()`.
- **Config:** `window.DriveWalletWidget` (network, targetId, theme, buttonLabel, tokenContracts, callbacks).
- **Callbacks:** onReady, onConnect, onDisconnect, onError, onAccountsChanged, onChainChanged.
- **Métodos:** `refreshBalances()` en `window.DriveWalletWidget`.
- **Datos:** Red desde `network-data.json` (misma origen que el script); sin cambios en origen ni en lo que exportamos.

---

## 3. Qué podemos aprender de Uniswap (sin copiar su ecosistema)

Objetivo: acercar **estructura y patrones** a Uniswap, manteniendo **nuestros datos y nuestra API pública**.

### 3.1 Separar “trigger” y “panel” (patrón Uniswap)

- **Hoy:** Un solo bloque: botón O barra conectada en el mismo div.
- **Aprendizaje:** Introducir un **modo opcional** “compact”:
  - **Trigger:** Solo un botón (desconectado) o una “pill” (dirección truncada + icono) (conectado). Un solo clic no conecta ni desconecta; **abre/cierra un panel**.
  - **Panel:** Dropdown o modal que contiene:
    - Si no conectado: botón “Connect” (o lista de wallets si en el futuro soportamos más de un provider).
    - Si conectado: dirección, red, refresh, disconnect (lo que hoy está en la barra).
- **Implementación sugerida:** Parámetro de config (p. ej. `data-layout="inline" | "dropdown"`). Por defecto `inline` para no romper integraciones actuales. Con `dropdown`, la Bridge orquesta un “estado de panel” (abierto/cerrado) y dos vistas: TriggerView + PanelView, usando el mismo Core y los mismos callbacks. **No cambia** `window.DriveWallet` ni los callbacks; solo la forma de presentar.

### 3.2 Estado de UI desacoplado del estado de conexión

- **Uniswap:** `accountDrawerOpenAtom` (Jotai) solo para “¿está abierto el drawer?”. La conexión vive en otro store.
- **Nosotros:** Podemos tener un estado interno **solo para el panel**: `panelOpen` (boolean). Se actualiza al hacer clic en el trigger o al cerrar el panel (clic fuera, Escape, o tras disconnect si se desea). El Core sigue siendo la única fuente de verdad para `connected`, `address`, etc. La UI solo lee estado del Core y `panelOpen` para decidir qué y dónde pintar.

### 3.3 Ref compartido entre trigger y panel (evitar cierre accidental)

- **Uniswap:** `Web3StatusRef` (Jotai) con la ref del botón; el dropdown la usa como “ignored node” para no cerrar al hacer clic en el trigger.
- **Nosotros:** Si añadimos panel/dropdown, el contenedor del trigger debe estar en la lista de “no cerrar al hacer clic aquí” cuando se use “click outside” para cerrar el panel. Así el implementador puede seguir usando un solo div contenedor y el comportamiento se parece al de Uniswap.

### 3.4 Estados de carga y transición explícitos

- **Uniswap:** Mientras `isConnecting` muestran “Connecting…” con el identificador de cuenta (no solo un spinner genérico).
- **Nosotros:** Durante `connect()` (entre `eth_requestAccounts` y la confirmación de red) podemos mostrar un estado **“Connecting…”** explícito en la UI (en inline o dentro del panel), sin cambiar la lógica del Core. Mejora la percepción de progreso y evita doble clic.

### 3.5 Un único punto de control para “abrir/cerrar el panel”

- **Uniswap:** `useAccountDrawer()` → `open()`, `close()`, `toggle()`. Cualquier parte de la app que quiera abrir el drawer usa el mismo hook.
- **Nosotros:** Si tenemos panel, exponer en la API pública algo opcional para el implementador: por ejemplo `window.DriveWalletWidget.openPanel()` y `closePanel()` (y quizá `togglePanel()`). Así el host puede abrir el panel desde un menú o un botón en otra parte de la página, manteniendo un solo lugar que decide si el panel está abierto o cerrado.

### 3.6 Estructura interna de “vistas” (documentar o refactorizar)

- **Uniswap:** Web3Status (trigger) → AccountDrawer (contenedor del panel) → DefaultMenu → MainMenu (no conectado: WalletModal; conectado: AuthenticatedHeader con DisconnectButton).
- **Nosotros:** Podemos nombrar y separar internamente (aunque siga siendo un solo script):
  - **TriggerView:** Solo el botón o la pill (conectado). Sin lógica; recibe estado del Core y callbacks (onOpenPanel, onConnect si se hace “connect” desde el trigger en modo inline).
  - **PanelView:** Contenido del dropdown/modal (botón Connect, o barra con address + disconnect + refresh). Solo presentación; las acciones llaman a Core (connect, disconnect, refresh).
  - **Bridge** sigue siendo el único que conoce Core + UI y el estado `panelOpen`. Esto acerca la **arquitectura mental** a la de Uniswap sin cambiar el contrato público.

### 3.7 Callbacks opcionales para el panel (si lo añadimos)

- **Uniswap:** Envían analytics en puntos clave (AccountDropdownButtonClicked, MiniPortfolioToggled, ConnectWalletButtonClicked).
- **Nosotros:** Ya tenemos onConnect, onDisconnect, onError. Si añadimos panel, podemos definir callbacks opcionales como `onPanelOpen` y `onPanelClose` para que el implementador pueda hacer tracking o sincronizar con su propia UI, sin tocar el resto del contrato.

### 3.8 Accesibilidad y teclado

- **Uniswap:** Uso de `data-testid`, manejo de teclado (p. ej. Enter en el botón).
- **Nosotros:** En SPECIFICATION.md ya se habla de clases estables y de no usar eval. Conviene hacer explícito: `role="button"` donde corresponda, `aria-label` en el botón Connect y en Disconnect, y soporte de tecla Enter/Space en el trigger y en los botones del panel. Así nos acercamos a las buenas prácticas que usa Uniswap en su interfaz.

---

## 4. Tabla comparativa (estructura y patrones)

| Aspecto | Uniswap | Nuestro widget (actual) | Ajuste propuesto (manteniendo nuestra API) |
|--------|---------|--------------------------|--------------------------------------------|
| **Trigger** | Botón o pill; clic = abrir drawer | Botón “Connect” o barra conectada inline | Opción `layout=dropdown`: trigger = botón/pill; clic = abrir panel. |
| **Panel** | Drawer con WalletModal o AuthenticatedHeader | No existe; todo inline | Opción dropdown: panel con mismo contenido (connect / address + disconnect + refresh). |
| **Estado UI** | Jotai (drawer open/closed) | No existe | Estado interno `panelOpen`; opcionalmente `openPanel()`/`closePanel()` en DriveWalletWidget. |
| **Estado conexión** | Store (wagmi + unificado) | Core (state + session) | Sin cambios. Core sigue siendo la única fuente de verdad. |
| **Ref trigger/panel** | Web3StatusRef para no cerrar al clic en trigger | N/A | Si hay dropdown: ignorar el nodo del trigger en “click outside”. |
| **Estado “Connecting”** | Visible en trigger | Implícito (no mostrado) | Añadir vista “Connecting…” durante connect(). |
| **Origen de datos** | Interno (RPC, GraphQL, etc.) | network-data.json | Sin cambios. |
| **Export al implementador** | Ninguno (app interna) | DriveWallet + DriveWalletWidget (callbacks, refreshBalances) | Sin cambios; opcionalmente openPanel/closePanel y onPanelOpen/onPanelClose. |

---

## 5. Qué mantener siempre (personalizaciones nuestras)

- **Origen de datos:** Red y parámetros de cadena desde `network-data.json` (misma origen que el script). Sin hardcodear chains en el widget.
- **API pública:**
  - `window.DriveWallet`: estado actualizado en tiempo real (connected, address, chainId, chainIdHex, networkName, environment, provider, nativeToken, tokens/tokenBalances, toJSON).
  - `window.DriveWalletWidget`: config (network, targetId, theme, buttonLabel, tokenContracts, etc.), callbacks (onReady, onConnect, onDisconnect, onError, onAccountsChanged, onChainChanged), `refreshBalances()`.
- **Embed:** Un script + un contenedor (o varios por `data-target-id`); config por data attributes y/o global. Sin dependencias de framework.
- **Core sin DOM:** La lógica de conexión, sesión y provider no depende de la UI; la UI solo recibe estado y chain params y pinta. Esto ya está alineado con el principio de Uniswap de separar estado de conexión y estado de UI.

---

## 6. Conclusión

- **Uniswap** nos da un patrón claro: **trigger (solo abrir/cerrar) + panel (contenido)** y **estado de UI (panel abierto/cerrado) separado del estado de conexión**. Nosotros podemos acercarnos a eso con:
  - Un **modo opcional “dropdown”** (trigger + panel) además del modo **inline** actual.
  - Un **estado interno de panel** y, si se desea, `openPanel()`/`closePanel()` y callbacks `onPanelOpen`/`onPanelClose`.
  - **Ref/click-outside** para no cerrar el panel al hacer clic en el trigger.
  - Un **estado “Connecting…”** visible durante `connect()`.
- **Mantener sin cambios:** origen de datos (`network-data.json`), contrato público (`window.DriveWallet`, `window.DriveWalletWidget`, callbacks, `refreshBalances`), modelo de embed y la separación Core / UI / Bridge. Con eso la estructura y la experiencia se acercan a cómo Uniswap usa su widget, sin perder nuestras personalizaciones ni lo que el implementador consume.
