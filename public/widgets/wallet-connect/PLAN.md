# Plan: Widget de conexión de wallet (Infinite Drive)

**Objetivo:** Publicar un widget estático que los sitios externos puedan incrustar (como `<div>` o bloque de script) para que los usuarios **conecten su wallet a la cadena Infinite Drive** y el sitio **mantenga un estado de conexión estable**. Este widget es la **capa de conexión**: una vez conectado, otros widgets que vosotros proporcionéis (transacciones, firma de contratos, operaciones concretas) podrán ejecutar acciones asumiendo que el sitio ya está conectado; el implementador les dará a esos otros widgets qué hacer, pero la conexión y el estado de “conectado / desconectado” los gestiona este widget.

---

## Estado actual y progreso (última actualización)

**Fase en curso:** Primer prototipo funcional.

| Ítem | Estado | Notas |
|------|--------|--------|
| 1. Archivo `wallet-connect.js` | Hecho | Config desde global + data attributes; orden de búsqueda del contenedor: `[data-drive-widget="wallet-connect"]` → id por `data-target-id` → primer `[data-network]`. Base URL = origin del script. Fetch a `{origin}/{network}/network-data.json`. |
| 2. Mapeo network-data → wallet | Hecho | `evm_chain_id` (decimal); el widget deriva el hex. `evm_chain_name`, RPC (primario o primero), `native_currency` con decimals desde denom_units (exponent 18 o mayor). Explorers → array de URLs. |
| 3. Wallet (provider, addChain, requestAccounts, eventos) | Hecho | Provider = `window.ethereum` o `ethereum[0]` si es array. addEthereumChain si la red no es la actual; luego eth_requestAccounts. Suscripción a accountsChanged y chainChanged; chainId normalizado a hex. |
| 4. Estado y API (`window.DriveWallet`, callbacks) | Hecho | Objeto público actualizado en connect/disconnect/eventos. Callbacks desde `window.DriveWalletWidget`: onReady, onConnect, onDisconnect, onError, onAccountsChanged, onChainChanged. |
| 5. UI mínima (inline, prefijo `.drive-wc-*`) | Hecho | Estados: cargando, sin wallet, listo (botón Connect), conectado (dirección truncada, red, Desconectar), error. Sin sessionStorage en este prototipo. |
| 6. Página de prueba | Hecho | `demo.html` en `widgets/wallet-connect/`: incluye el widget con `data-network="mainnet"` y un bloque que muestra `window.DriveWallet` (actualizado cada 2 s y con botón Refresh). |
| 7. Persistencia sessionStorage + restauración | Hecho | Al conectar se guarda en `sessionStorage` (clave `drive-wallet-session`) la red, dirección, chainId y networkName. Al desconectar o al recibir `accountsChanged` vacío se borra. Al cargar la página, si hay sesión para la misma red se llama `eth_accounts` (sin popup); si el wallet devuelve cuentas se restaura el estado y se muestra "Conectado" sin pedir Connect de nuevo. Si no hay cuentas (usuario revocó en MetaMask) se limpia la sesión y se muestra el botón Connect. |
| 8. Correcciones post-auditoría | Hecho | Tras la auditoría (ver `AUDIT.md`): (1) Listeners del provider: se guardan referencias y se eliminan en desconectar/reconectar para evitar duplicados. (2) Escape HTML: `escapeAttr()` en dirección y `title` en `renderConnected`. (3) Claridad: lógica de error de `run()` extraída a `handleRunError()`. (4) Comentarios de sección en el código. (5) Comentario en `getConfig()` sobre precedencia global vs data-attributes. Registro detallado en AUDIT.md §3. |

**Dónde estamos:** Primer prototipo con persistencia de sesión. Tras conectar, un refresh de página restaura el estado si el wallet sigue autorizando el sitio. Siguiente iteración: temas (`data-theme`), refinar spec, botón copiar dirección, etc.

**Pendiente (origen de datos):** Actualizar los JSON de las redes (mainnet, testnet, creative) y su documentación para que el origen deje de exponer `evm_chain_id_hex`; el widget usa solo `evm_chain_id` (decimal) y deriva el hex en código.

---

## 1. Alcance del widget

- **Responsabilidad de este widget:**
  - **Conectar** la wallet del usuario a la red Infinite Drive (mainnet, testnet o creative): añadir la red al wallet y solicitar cuentas (`eth_requestAccounts`).
  - **Mantener y exponer un estado de conexión estable en el sitio:** el usuario ve que está conectado, puede ver **qué dirección** está usando y **en qué red** está, y puede **desconectarse** cuando quiera.
  - **Servir de base para otros widgets:** exponer una API o estado (por ejemplo en `window` o por eventos) para que otros widgets vuestros, en la misma página, sepan si hay conexión, qué cuenta y qué red hay, y puedan realizar transacciones, firmar o ejecutar operaciones sin tener que pedir de nuevo la conexión.
- **Lo que no hace este widget:** No ejecuta transacciones ni firma contratos; eso lo harán otros widgets que el implementador integre y a los que les indique qué acción realizar, usando la conexión ya establecida por este widget.
- **Datos de red:** Tomar parámetros de `network-data.json` ya publicados en este host (`/mainnet/network-data.json`, `/testnet/network-data.json`, `/creative/network-data.json`), de modo que el widget no tenga la red “hardcodeada” y se actualice cuando actualicen los JSON.
- **Host estático:** Todo el widget son archivos estáticos (HTML/JS/CSS) servidos desde el mismo host que hoy (Cloudflare Assets con `public/`), sin backend propio.
- **Embeddable:** El sitio del usuario solo incluye un fragmento (div + script, o solo script) y opcionalmente callbacks para reaccionar (conectado, desconectado, cambio de cuenta/red, error).

---

## 2. Formas de incrustación

### 2.1 Opción A: Contenedor div + script

El desarrollador coloca un contenedor y carga el script del widget. El script busca el contenedor (por id o por data-attribute) y pinta la UI dentro.

```html
<!-- En el sitio del usuario -->
<div id="drive-wallet-widget" data-network="mainnet"></div>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect.js" async></script>
```

- **Ventaja:** Control total del lugar donde aparece el widget (layout, sidebar, modal).
- **Configuración por data-attributes:** `data-network` (mainnet | testnet | creative), `data-button-label`, `data-theme`, `data-styles` (ver sección 6.1), etc.

### 2.2 Opción B: Solo script (widget auto-montado)

Un único script que, al cargar, crea el contenedor y el botón (por ejemplo al final del `body` o dentro de un elemento con id conocido).

```html
<script
  src="https://assets.infinitedrive.xyz/widgets/wallet-connect.js"
  data-network="mainnet"
  data-mount="auto"
  data-target-id="drive-wallet"
  async
></script>
<div id="drive-wallet"></div>
```

- **Ventaja:** Mínimo código en el sitio; solo un `<div>` + `<script>`.

### 2.3 Opción C: Código JavaScript (para SPAs o integración programática)

Para aplicaciones que no quieren depender de un script externo en el `<head>`, se puede ofrecer un snippet que dinámicamente inyecta el script y opcionalmente pasa opciones por un global antes de cargar.

```html
<script>
  window.DriveWalletWidget = { network: 'mainnet', onConnect: function(accounts) { console.log('Connected', accounts); } };
</script>
<script src="https://assets.infinitedrive.xyz/widgets/wallet-connect.js" async></script>
```

Todas las opciones pueden coexistir: el mismo `wallet-connect.js` detecta si hay un `data-network` en el script, un `data-*` en un div, o un `window.DriveWalletWidget` y actúa en consecuencia.

---

## 3. Comportamiento funcional

1. **Carga de parámetros de red:**  
   El widget hace `fetch` a `/{network}/network-data.json` (por ejemplo `https://assets.infinitedrive.xyz/mainnet/network-data.json`). De ahí obtiene:
   - `evm_chain_id`, `evm_chain_id_hex`, `evm_chain_name`, `evm_network_id`
   - `endpoints.json-rpc-http[0].url` como RPC URL
   - `native_currency` (nombre, símbolo, decimals vía denom_units)
   - Opcional: `explorers` para block explorer

2. **Detección de wallet:**  
   Comprobar `window.ethereum`. Si no existe, mostrar mensaje claro (“Instala MetaMask o un wallet compatible con EVM”) y, si se desea, enlace a metamask.io o a una página de “Cómo conectar” en infinitedrive.xyz.

3. **Conectar:**  
   - Añadir la red con `wallet_addEthereumChain` (chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls).  
   - Llamar a `eth_requestAccounts` para obtener las cuentas y establecer la conexión en el sitio.

4. **Estado de conexión estable en el sitio:**  
   - Tras una conexión correcta, el widget **mantiene** ese estado en la página (y opcionalmente lo persiste, por ejemplo en `sessionStorage`, para que al recargar el usuario siga “conectado” si el wallet sigue autorizando el sitio).  
   - El widget **muestra** que está conectado: dirección (resumida, p. ej. `0x1234…abcd`), red actual (nombre o chainId), y un control para **desconectar**.  
   - **Desconectar:** el widget ofrece una acción “Desconectar” que limpia el estado en el sitio (y en sessionStorage si se usa). No revoca permisos en el wallet (el usuario puede seguir teniendo el sitio en la lista de “conectados” en MetaMask); lo que hace es que el sitio deje de considerar que hay una cuenta activa hasta que el usuario vuelva a conectar.

5. **Reacción a cambios externos:**  
   Escuchar eventos del provider (`accountsChanged`, `chainChanged`) para actualizar la UI y el estado: si el usuario cambia de cuenta o de red en el wallet, el widget refleja ese cambio (y opcionalmente notifica a otros widgets vía callbacks o API).

6. **API para otros widgets y para el implementador:**  
   - **Estado legible:** Exponer en un objeto global (p. ej. `window.DriveWallet` o `window.DriveWalletWidget`) el estado actual: `{ connected: boolean, address: string | null, chainId: string | null, networkName: string | null, provider: EIP1193Provider | null }`. Así, otros widgets vuestros (transacciones, firma, etc.) pueden leer “¿hay conexión? ¿qué cuenta? ¿qué red?” y ejecutar la acción que el implementador les haya configurado.  
   - **Callbacks:**  
     - `onReady()` — widget cargado y datos de red listos.  
     - `onConnect(state)` — usuario conectado; `state` incluye `address`, `chainId`, `networkName`.  
     - `onDisconnect()` — usuario desconectó desde el widget.  
     - `onAccountsChanged(accounts)`, `onChainChanged(chainId)` — opcional, para que el implementador reaccione a cambios.  
     - `onError(message | error)` — fallo (sin wallet, usuario rechaza, fetch falla, etc.).  
   Los callbacks se configuran vía `window.DriveWalletWidget` (o el nombre que se adopte) antes de cargar el script.

---

## 4. Estructura de archivos (dentro de `public/`)

```
public/
  widgets/
    index.html                    # Listado de widgets
    wallet-connect/
      index.html                  # Página principal del widget (muestra overview.md)
      overview.md                 # Resumen corto y cómo usarlo (vista usuario)
      spec.html                   # Vista en navegador de la especificación
      SPECIFICATION.md            # Especificación técnica completa
      PLAN.md                     # Este plan (uso interno)
      wallet-connect.js           # Bundle del widget (primer prototipo listo)
      demo.html                   # Página de prueba del widget (conectar, estado, DriveWallet)
      wallet-connect.css          # (Opcional) Estilos; MVP usa inline en .js
      embed.js                    # (Opcional) Loader que inyecta .js + .css
```

**Rutas públicas (ejemplo con host assets):**

- `https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.js`
- `https://assets.infinitedrive.xyz/widgets/wallet-connect/wallet-connect.css`
- Opcional: `https://assets.infinitedrive.xyz/widgets/wallet-connect/embed.js` (solo carga script + css y opciones).

**Versión mínima (MVP):** Un solo archivo `wallet-connect.js` que incluye estilos inline o en un `<style>` inyectado para no depender de un segundo request. Así el usuario solo añade un `<script>`.

---

## 5. Consideraciones técnicas

- **CORS:** Los `network-data.json` se sirven desde el mismo origen (assets). Si en el futuro el widget se sirve desde otro subdominio, habrá que asegurar CORS en Cloudflare/Worker para esos JSON (o seguir sirviendo el script desde el mismo host que los JSON).
- **Sin dependencias:** Mantener el widget en vanilla JS (sin React/Vue) para que funcione en cualquier página y no haya conflictos de versiones. Si más adelante se quiere un build (minificación, env), se puede usar un paso opcional (ej. esbuild) antes de `wrangler deploy`.
- **Versionado:** Para no romper a los que ya incrustan el script, se puede publicar por versión:  
  `widgets/wallet-connect/v1/wallet-connect.js`  
  y la “latest” como copia o redirect. En el MVP se puede tener solo `wallet-connect.js` y documentar que el comportamiento estable se mantiene.
- **Seguridad:** No inyectar HTML arbitrario desde el dominio del usuario; solo datos que vengan de nuestro `network-data.json` y textos controlados. Evitar `eval` y atributos que ejecuten código del sitio (por ejemplo no usar `data-on-connect` como código a evaluar).
- **Privacidad:** El widget no envía datos a ningún servidor propio; solo usa `window.ethereum` y nuestro host para leer `network-data.json`.
- **Estilos y personalización:** Todas las clases del widget usan un prefijo (p. ej. `.drive-wc-*`) para no colisionar con el CSS del sitio. Se soportan tres modos: estilos por defecto (con tema), personalización vía variables CSS, o modo “solo clases” para que el implementador aplique estilos 100 % custom (ver sección 6.1).

---

## 6. UI sugerida (MVP)

- **Sin conectar:**  
  - Un botón: “Conectar a Infinite Drive” (añade red si hace falta + solicita cuentas).  
  - Estados: idle → loading (fetch network-data) → listo → “Conectar” → success o error.  
  - Mensajes claros: “Por favor instala MetaMask (o un wallet EVM)”, “Usuario rechazó la conexión”, etc.

- **Conectado:**  
  - Mostrar **estado de conexión**: texto o icono que indique “Conectado”.  
  - Mostrar **dirección** resumida (p. ej. `0x1234…abcd`), con opción de copiar si se desea.  
  - Mostrar **red** actual (nombre de la red o chainId), para que el usuario sepa si está en mainnet/testnet/creative.  
  - Botón o enlace **“Desconectar”** que limpia el estado en el sitio y vuelve a la vista “Sin conectar”.  
  - Si el usuario cambia de cuenta o de red en el wallet, la UI se actualiza (accountsChanged / chainChanged).

- **Estilo por defecto:** Opción “theme” (light/dark/cyberpunk) con clases CSS o variables, alineado al estilo de Project 42 para la página de widgets, y adaptable para sitios externos.

### 6.1 Estilos: opciones para el implementador

El implementador puede elegir cómo quiere que se vea el widget en su sitio:

1. **Usar estilos por defecto**  
   Sin configurar nada (o `data-styles="default"`), el widget aplica su propia hoja de estilos (inline o `wallet-connect.css`), con opción de tema vía `data-theme` (p. ej. `light`, `dark`, `cyberpunk`). Cero esfuerzo para que el widget se vea bien.

2. **Personalizar los estilos**  
   El widget usa **variables CSS** (custom properties) o **clases con prefijo** (p. ej. `.drive-wc-*`) en todos los elementos. El implementador puede:
   - Sobrescribir solo algunas variables (colores, fuentes, bordes) en su CSS para adaptar el widget a su marca sin tocar la estructura.
   - Incluir su propia hoja que redefina las variables o las clases del widget.

   Ejemplo: el widget define `--drive-wc-button-bg`, `--drive-wc-button-color`, `--drive-wc-font-family`; el sitio asigna valores en un selector que englobe al contenedor del widget.

3. **Estilos totalmente custom (sin estilos por defecto)**  
   Opción tipo `data-styles="none"` o `data-styles="custom"`: el widget **no inyecta** estilos propios (o solo estilos mínimos de layout que no afecten aspecto). Todo el markup tiene **clases semánticas y estables** (p. ej. `.drive-wc-root`, `.drive-wc-button`, `.drive-wc-address`, `.drive-wc-disconnect`), de modo que el implementador puede dar **todos** los estilos desde su CSS. Útil para integrar el widget en un diseño ya existente sin luchar contra estilos por defecto.

Configuración posible por data-attributes o por `window.DriveWalletWidget`: `data-theme`, `data-styles` (default | custom | none), y opcionalmente un prefijo de clase personalizado si en el futuro se quisiera evitar colisiones con otros componentes.

---

## 7. Orden de implementación sugerido

1. **Fase 1 — Datos y lógica**
   - Crear `wallet-connect.js` que:
     - Lee `data-network` (o default mainnet) y hace fetch a `/{network}/network-data.json`.
     - Parsea `evm_chain_id`, RPC, native_currency, explorers y construye el objeto para `wallet_addEthereumChain`.
     - Detecta `window.ethereum` y muestra mensaje si no hay.
   - Implementar `wallet_addEthereumChain` y `eth_requestAccounts` para conectar.
   - Mantener estado interno: `connected`, `address`, `chainId`, `networkName`; opcionalmente persistir en `sessionStorage` para restaurar sesión al recargar.
   - Implementar **desconexión**: limpiar estado (y sessionStorage) y actualizar UI.
   - Escuchar `accountsChanged` y `chainChanged` del provider para mantener estado y UI al día.
   - Exponer **estado y API** en `window.DriveWallet` (o similar): objeto legible por otros widgets (`connected`, `address`, `chainId`, `networkName`, `provider`) y callbacks (`onReady`, `onConnect`, `onDisconnect`, `onAccountsChanged`, `onChainChanged`, `onError`).

2. **Fase 2 — Montaje en DOM y UI**
   - Buscar contenedor por id o `data-drive-widget="wallet-connect"`.
   - **Vista sin conectar:** botón “Conectar a Infinite Drive” y estados (loading, error).
   - **Vista conectada:** indicador “Conectado”, dirección resumida (y opcional copiar), nombre de red, botón “Desconectar”.
   - Estilos inline o en `<style>` en el mismo JS para MVP; respetar opción de estilos (default / personalizar variables / custom) según sección 6.1.

3. **Fase 3 — Documentación y embeds**
   - Actualizar `widgets/index.html` con la sección “Wallet Connect”: descripción, ejemplos de incrustación, opciones y API para otros widgets, enlace a este plan.
   - Añadir un ejemplo en vivo en la página para probar conexión, estado (dirección, red) y desconexión.

4. **Fase 4 (opcional)**
   - Extraer CSS a `wallet-connect.css` con variables CSS documentadas para personalización; ofrecer temas “cyberpunk” / “minimal”.
   - Implementar `data-styles="none"` o `data-styles="custom"`: no inyectar estilos de aspecto, solo clases semánticas para que el implementador use estilos 100 % propios.
   - `embed.js` que solo carga JS + CSS y lee data-attributes.
   - Versionado `v1/` y documentar política de no-breaking.

---

## 8. Resumen

| Aspecto | Decisión |
|--------|----------|
| Rol del widget | Capa de conexión: conectar, mantener estado estable en el sitio, mostrar dirección y red, permitir desconectar; otros widgets realizan acciones (transacciones, firma) usando esta conexión |
| Publicación | Estática desde el mismo host (Cloudflare Assets, `public/`) |
| Incrustación | Div + script; opcionalmente solo script con data-attributes |
| Configuración | `data-network`, `data-mount`, `window.DriveWalletWidget` (callbacks y opciones) |
| Estado en el sitio | Conectado / desconectado; dirección y red visibles; opcional persistencia en `sessionStorage` |
| Desconexión | Acción “Desconectar” que limpia estado en el sitio (el sitio deja de considerar cuenta activa) |
| API para otros widgets | Estado legible en `window.DriveWallet` (o similar): `connected`, `address`, `chainId`, `networkName`, `provider`; callbacks `onConnect`, `onDisconnect`, etc. |
| Datos de red | Siempre desde `/{mainnet|testnet|creative}/network-data.json` |
| Wallet API | `wallet_addEthereumChain` + `eth_requestAccounts`; escuchar `accountsChanged` y `chainChanged` |
| Dependencias | Ninguna; vanilla JS |
| Estilos | El implementador puede: (1) usar estilos por defecto y tema (`data-theme`), (2) personalizar vía variables CSS o sobrescribir clases con prefijo `.drive-wc-*`, (3) usar solo clases sin estilos de aspecto (`data-styles="custom"`) y aplicar estilos 100 % propios |

Con esto se puede implementar un widget estático que proporcione conexión estable en el sitio, estado visible (dirección, red) y desconexión, y que sirva de base para que otros widgets ejecuten operaciones con la wallet ya conectada.

---

## 9. Reporte de análisis: fortalezas y puntos de mejora

Este apartado resume el análisis realizado sobre la documentación de usuario (overview, índice) y la especificación técnica, desde la perspectiva de **diseño de producto** y de **ingeniería de software**, para ir cerrando huecos y priorizar trabajo.

### 9.1 Perspectiva diseño de producto

**Fortalezas**

- Overview con estructura clara: qué es → qué hace → cómo usarlo → más información.
- Lenguaje directo y orientado al implementador; un solo ejemplo de código para arrancar.
- Especificación bien estructurada (TOC, tablas, ejemplos por modo de integración).
- Separación clara entre alcance (in/out), flujo, configuración, API y estilos.

**Puntos de mejora (a abordar en iteraciones)**

- Añadir en el overview (o en una página dedicada) una **descripción breve o mockup de la UI** (botón Connect, estado conectado con dirección, desconectar) para que producto/diseño puedan validar sin implementar.
- Dejar explícitos los **requisitos previos** para el implementador: navegador con soporte a `window.ethereum`, sitio en HTTPS si aplica, etc.
- Incluir una o dos frases sobre **qué pasa cuando algo falla** (sin wallet, usuario rechaza, red incorrecta) y enlace a la spec o a una guía de troubleshooting.
- Valorar **unificar idioma** en el índice de widgets (descripción vs enlaces) o etiquetar el idioma de cada documento.
- En la spec, opcional: **mini-glossario** o enlaces para términos (EIP-1193, wallet_addEthereumChain, “connection layer”) para perfiles menos técnicos.
- Documentar **variables CSS** que el widget usa (lista canónica) para que la personalización vía variables esté completa en la spec.

### 9.2 Perspectiva ingeniería de software

**Lo que está bien definido y permite implementar**

- Flujo de alto nivel, uso de EIP-1193, formas de incrustación, configuración (data attributes + global), forma del estado y callbacks, modos de estilo, seguridad y privacidad, estructura de archivos y campos de `network-data.json` a usar.

**Ambigüedades o huecos a cerrar (para implementación sin reinterpretaciones)**

1. **Resolución del contenedor:** Orden de precedencia y selector concreto cuando coexisten div con `data-network`, `data-target-id` en el script, o `[data-drive-widget="wallet-connect"]`. Definir en la spec el algoritmo (p. ej. primero atributo, luego id, etc.).
2. **Base URL del script:** Cómo se obtiene (p. ej. `document.currentScript.src` y extracción de origin o path base) para el fetch de `network-data.json` en distintos entornos.
3. **`native_currency.decimals`:** Regla explícita para derivar `decimals` desde `denom_units` (p. ej. usar el `exponent` del denom_unit con exponent 18, o el mayor exponent).
4. **Explorers:** Mapeo explícito de `explorers[]` del JSON (objetos con `url`) a `blockExplorerUrls: string[]` para `wallet_addEthereumChain` (p. ej. solo primary o todos).
5. **Persistencia en `sessionStorage`:** Clave, formato (address, chainId, etc.) y flujo de restauración: qué hacer si al cargar mostramos “conectado” desde sessionStorage pero el usuario ya revocó el sitio en el wallet (re-solicitar cuentas vs mostrar desconectado).
6. **Múltiples providers (`window.ethereum` como array):** Decisión documentada (v1: usar el primer provider disponible).
7. **Formato de `chainId`:** Normalizar siempre a hex string en estado y en `chainChanged` para evitar diferencias entre wallets.
8. **Estados de carga y error en UI:** Mensajes y estados concretos (loading network-data, sin wallet, usuario rechaza, fetch falla, red distinta); si el botón Connect se deshabilita hasta tener datos.
9. **Precedencia configuración global vs data attributes:** Regla clara (por opción: global gana si está definido, o siempre global).
10. **Nombres globales:** Fijar en la spec los nombres exactos (`window.DriveWallet`, `window.DriveWalletWidget`) como contrato.
11. **Apéndice de la spec:** Actualizar estructura de archivos (overview.md, index.html, spec.html, SPECIFICATION.md, PLAN.md) para que coincida con el repo.

**Conclusión del análisis**

- Es posible implementar el widget y que sea funcional; la documentación es clara en lo esencial.
- Para una implementación única y sin ambigüedades, conviene cerrar los puntos anteriores en la especificación (y en este plan donde aplique) a medida que se avanza con el código.

---

## 10. Roadmap de implementación: qué trabajar ahora

**Flujo acordado**

1. **Primero:** Tener un **primer prototipo estable y en funcionamiento** (widget que se pueda incrustar, conectar, mostrar estado y desconectar).
2. **Después:** Ir haciendo **iteraciones incrementales** tanto sobre el **código funcional** como sobre las **descripciones y guías** (overview, spec, índices). Cada iteración puede cerrar huecos del análisis (sección 9) o añadir funcionalidad (temas, sessionStorage, copy address, etc.).

**Trabajo inmediato: primer prototipo funcional**

Objetivo: que un desarrollador pueda incluir el script en una página, ver el botón “Conectar a Infinite Drive”, conectar su wallet, ver dirección y red, desconectar, y que otro script pueda leer `window.DriveWallet`.

**Checklist para el primer prototipo (orden sugerido)**

1. **Archivo único `wallet-connect.js`** (en `widgets/wallet-connect/`):
   - Obtener configuración: `data-network` (default `mainnet`), contenedor: definir y documentar orden de búsqueda (p. ej. `[data-drive-widget="wallet-connect"]` o elemento con id indicado por `data-target-id` en el script, o primer `[data-network]`).
   - Resolver base URL del script desde `document.currentScript.src` (origin o path base) para construir la URL de `network-data.json`.
   - `fetch` a `{base}/{network}/network-data.json`; manejar error (mostrar mensaje en UI).

2. **Mapeo de network-data a parámetros de wallet:**
   - Leer `evm_chain_id_hex`, `evm_chain_name`, `endpoints.json-rpc-http` (primario o primero), `native_currency`: nombre, símbolo, y **decimals** derivados de `denom_units` (regla: usar exponent del denom con exponent 18, o el mayor).
   - Leer `explorers`: mapear a array de URLs (p. ej. `explorers[].url` o solo el marcado primary).
   - Construir objeto para `wallet_addEthereumChain`.

3. **Wallet:**
   - Detectar `window.ethereum` (si es array, usar el primero). Si no hay, mostrar mensaje fijo (“Instala MetaMask o un wallet compatible con EVM”) y no llamar a connect.
   - Al pulsar conectar: `wallet_addEthereumChain` si hace falta; luego `eth_requestAccounts`. En éxito, guardar address, chainId, networkName; actualizar estado interno y UI.
   - Suscribirse a `accountsChanged` y `chainChanged`; normalizar `chainId` a hex string; actualizar estado y UI.

4. **Estado y API:**
   - Objeto interno y objeto público en `window.DriveWallet`: `connected`, `address`, `chainId`, `networkName`, `provider`. Mantenerlo actualizado en connect, disconnect y eventos.
   - Callbacks opcionales desde `window.DriveWalletWidget` si existe al cargar: `onReady`, `onConnect`, `onDisconnect`, `onError`. Invocarlos en los momentos indicados en la spec.

5. **UI mínima (inline en el mismo JS):**
   - Un solo modo de estilos por ahora (default con prefijo `.drive-wc-*`).
   - Estados: (a) Cargando network-data, (b) Sin wallet, (c) Listo para conectar (botón “Conectar a Infinite Drive”), (d) Conectado: texto “Conectado”, dirección truncada, red, botón “Desconectar”, (e) Error (mensaje según fallo).
   - Desconectar: limpiar estado en memoria y en UI; no tocar sessionStorage en el primer prototipo si se quiere simplificar.

6. **Probar en una página real:**
   - Página de prueba (p. ej. en `widgets/wallet-connect/` o en `widgets/index.html`) con un div + script que cargue `wallet-connect.js` desde la ruta local/publicada, contra mainnet (o testnet) y verificar connect, estado, disconnect y lectura de `window.DriveWallet`.

**Después del primer prototipo (iteraciones)**

- Añadir persistencia en `sessionStorage` (clave, formato, flujo de restauración) y actualizar spec/plan.
- Refinar resolución de contenedor y documentarla en la spec.
- Añadir opciones de tema (`data-theme`) y/o `data-styles="custom"` con solo clases.
- Mejorar overview y spec con: requisitos previos, mensajes de error, (opcional) descripción o mockup de UI, lista de variables CSS.
- Añadir botón “Copiar” para la dirección si se desea.
- Versionado (v1/) y política de no-breaking cuando se estabilice la API.

---

**Documento técnico formal (en inglés):** Para arquitectura, uso, personalización y API de implementadores, ver [SPECIFICATION.md](SPECIFICATION.md) (vista en navegador: [spec.html](spec.html)).
