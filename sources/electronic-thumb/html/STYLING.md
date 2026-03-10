# Styling — Electronic Thumb

The widget uses **CSS variables** (custom properties) for all visual values. You define the variables you want to change on the **widget container** (the element with the `electronic-thumb-widget` attribute; you can give it an `id`, e.g. `my-electronic-thumb`, to target it from your CSS). Any variable you do not define keeps the widget’s default value.

---

## How to apply

1. **Identify the widget container**  
   It is the element with the `electronic-thumb-widget` attribute where the UI is mounted (e.g. `<div id="my-electronic-thumb" electronic-thumb-widget>`). The `id` is optional and is used to target that element from your CSS.

2. **Set the variables on that container**  
   In your own stylesheet (or in a `<style>` on the page), write a selector that targets that container and define the variables you want to change.

**Example:** if the container has `id="my-widget"`:

```css
#my-widget {
  --et-trigger-connect-bg: #6366f1;
  --et-trigger-connect-bg-hover: #4f46e5;
  --et-drawer-bg: #1e1e2e;
  --et-drawer-radius: 12px;
  --et-drawer-anchor-gap: 8px;
  --et-drawer-anchor-right-margin: 1rem;
}
```

Variables you do not define will keep the widget’s default value.

### Button text and icon

The Connect button **label** and **icon** are not set via CSS but via the widget config. Before loading the widget script, set `window.ElectronicThumb` with:

- **`connectButtonLabel`** — Text shown on the Connect button (e.g. `"Connect"`).
- **`connectButtonLoadingLabel`** — Text shown while connecting (e.g. `"Connecting…"`).
- **`connectButtonImage`** — URL of an image (or data URI) used as the button icon; optional.

Example:

```html
<script>
  window.ElectronicThumb = {
    connectButtonLabel: "Connect wallet",
    connectButtonLoadingLabel: "Connecting…",
    connectButtonImage: "https://example.com/my-icon.svg"
  };
</script>
<script src="/widgets/electronic-thumb/electronic-thumb.js"></script>
```

Full config options and callbacks are described in [ARCHITECTURE.md](ARCHITECTURE.md); the [Quick start](quick-start.html) page shows a working example.

---

## Variable list

Prefix: **`--et-`** (Electronic Thumb).

### Base typography

| Variable | Description | Default |
|----------|-------------|---------|
| `--et-font-family` | Widget font family | `system-ui, -apple-system, sans-serif` |
| `--et-font-size` | Base font size | `14px` |
| `--et-color-text` | Primary text color | `#e5e5e5` |
| `--et-color-text-muted` | Secondary text color | `#a3a3a3` |

---

### Trigger (Connect button / address)

Text and icon colors can be set **independently** per state. Override the variables below to match your site; the values in the table are the widget defaults.

| Variable | Description | Default |
|----------|-------------|---------|
| `--et-trigger-padding-block` | Vertical padding of the button | `10px` |
| `--et-trigger-padding-inline` | Horizontal padding of the button | `16px` |
| `--et-trigger-radius` | Button border radius | `12px` |
| `--et-trigger-font-size` | Button font size | `14px` |
| `--et-trigger-font-weight` | Button font weight | `500` |
| `--et-trigger-gap` | Space between icon, text and chevron | `6px` |
| `--et-trigger-transition` | Button transition | `background 0.15s, color 0.15s` |
| `--et-trigger-connect-bg` | Connect button background | `rgba(255, 255, 255, 0.07)` |
| `--et-trigger-connect-bg-hover` | Connect button background on hover | `rgba(255, 255, 255, 0.12)` |
| `--et-trigger-connect-text-color` | Text color when disconnected or loading | `#94a3b8` |
| `--et-trigger-connect-icon-color` | Icon color when disconnected or loading | `#94a3b8` |
| `--et-trigger-loading-bg` | Button background when “Connecting…” | `rgba(255, 255, 255, 0.05)` |
| `--et-trigger-connected-bg` | Button background when connected | `rgba(255, 255, 255, 0.06)` |
| `--et-trigger-connected-bg-hover` | Button background on hover when connected | `rgba(255, 255, 255, 0.1)` |
| `--et-trigger-connected-text-color` | Text color when connected (address, chevron) | `#4ade80` |
| `--et-trigger-connected-icon-color` | Icon color when connected | `#4ade80` |
| `--et-trigger-chevron-size` | Chevron icon size | `10px` |
| `--et-trigger-chevron-opacity` | Chevron opacity | `0.8` |
| `--et-trigger-connect-icon-size` | Trigger icon size (hitchhikers icon) | `20px` |
| `--et-trigger-icon-url` | URL of the trigger icon (SVG used as mask) | `url("/img/hitchhikers.svg")` |

---

### Floating panel (drawer)

| Variable | Description | Default |
|----------|-------------|---------|
| `--et-drawer-backdrop-bg` | Backdrop layer background behind the panel | `rgba(0, 0, 0, 0.4)` |
| `--et-drawer-backdrop-z` | Backdrop z-index | `9998` |
| `--et-drawer-top` | Panel top position (fixed; does not apply when panel is anchored) | `56px` |
| `--et-drawer-right` | Panel right position (fixed; does not apply when panel is anchored) | `12px` |
| `--et-drawer-anchor-gap` | Gap between anchor element and panel | `8px` |
| `--et-drawer-anchor-right-margin` | Panel right margin relative to anchor’s right edge (e.g. `1rem`) | `0px` |
| `--et-drawer-width` | Panel width | `368px` |
| `--et-drawer-max-height` | Panel max height | `calc(100vh - 80px)` |
| `--et-drawer-bg` | Panel background | `#1a1a1a` |
| `--et-drawer-border-width` | Panel border width | `1px` |
| `--et-drawer-border-color` | Panel border color | `rgba(255, 255, 255, 0.12)` |
| `--et-drawer-radius` | Panel border radius | `16px` |
| `--et-drawer-z` | Panel z-index | `9999` |
| `--et-drawer-shadow` | Panel box shadow | `0 8px 32px rgba(0, 0, 0, 0.4)` |
| `--et-drawer-content-padding` | Panel content padding | `16px` |
| `--et-drawer-header-padding-bottom` | Header (address + network) bottom padding | `12px` |
| `--et-drawer-header-border-color` | Header bottom border color | `rgba(255, 255, 255, 0.08)` |
| `--et-drawer-header-margin-bottom` | Header bottom margin | `12px` |
| `--et-drawer-address-font-size` | Address font size | `16px` |
| `--et-drawer-address-font-weight` | Address font weight | `500` |
| `--et-drawer-chain-font-size` | Network name font size | `12px` |
| `--et-drawer-chain-color` | Network name color | `#a3a3a3` |
| `--et-drawer-chain-margin-top` | Network name top margin | `4px` |
| `--et-drawer-section-margin-top` | Section top margin | `8px` |
| `--et-drawer-section-title-font-size` | Section title font size | `12px` |
| `--et-drawer-section-title-font-weight` | Section title font weight | `600` |
| `--et-drawer-section-title-color` | Section title color | `#a3a3a3` |
| `--et-drawer-section-title-margin-bottom` | Section title bottom margin | `8px` |
| `--et-drawer-row-padding-block` | Row (button) vertical padding | `12px` |
| `--et-drawer-row-padding-inline` | Row horizontal padding | `14px` |
| `--et-drawer-row-margin-bottom` | Margin between rows | `4px` |
| `--et-drawer-row-radius` | Row border radius | `12px` |
| `--et-drawer-row-bg` | Row background | `rgba(255, 255, 255, 0.06)` |
| `--et-drawer-row-bg-hover` | Row background on hover | `rgba(255, 255, 255, 0.1)` |
| `--et-drawer-row-color` | Row text color | `#e5e5e5` |
| `--et-drawer-row-font-size` | Row font size | `14px` |
| `--et-drawer-row-transition` | Row transition | `background 0.15s` |
| `--et-drawer-row-disabled-opacity` | Disabled row opacity | `0.85` |
| `--et-drawer-row-current-bg` | “Current network” row background | `rgba(34, 197, 94, 0.15)` |
| `--et-drawer-row-current-border` | “Current network” row border | `1px solid rgba(34, 197, 94, 0.4)` |
| `--et-drawer-badge-font-size` | “Current” badge font size | `11px` |
| `--et-drawer-badge-font-weight` | Badge font weight | `600` |
| `--et-drawer-badge-color` | “Current” badge color | `#22c55e` |
| `--et-drawer-disconnect-color` | Disconnect button color | `#f87171` |
| `--et-drawer-disconnect-bg-hover` | Disconnect button background on hover | `rgba(248, 113, 113, 0.15)` |

---

## Example: light theme

```css
#my-widget {
  --et-trigger-connect-bg: #3b82f6;
  --et-trigger-connect-bg-hover: #2563eb;
  --et-trigger-connected-bg: rgba(0, 0, 0, 0.06);
  --et-trigger-connected-bg-hover: rgba(0, 0, 0, 0.1);
  --et-trigger-connected-text-color: #1a1a1a;
  --et-trigger-connected-icon-color: #1a1a1a;
  --et-drawer-bg: #ffffff;
  --et-drawer-border-color: rgba(0, 0, 0, 0.1);
  --et-drawer-header-border-color: rgba(0, 0, 0, 0.08);
  --et-drawer-row-bg: rgba(0, 0, 0, 0.04);
  --et-drawer-row-bg-hover: rgba(0, 0, 0, 0.08);
  --et-drawer-row-color: #1a1a1a;
  --et-drawer-chain-color: #64748b;
  --et-drawer-section-title-color: #64748b;
}
```

---

## Notes

- Variables are inherited: you can define them on the widget container or any ancestor (e.g. `body` if the widget is the only app on the page).
- You do not need to define all variables; only those you want to change.
- Values must be **valid CSS declarations** (colors, lengths, etc.). For more radical themes you can override most of the variables listed above.
