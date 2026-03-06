# Wallet Connect v2 (CROC) – Implementación oficial limpia

## Cómo usarlo (3 líneas)

```html
<script src="/widgets/wallet-connect-v2/wallet-connect-v2.js" data-network="mainnet"></script>

<script>
  DriveWalletV2.connect().then(state => console.log(state));
  DriveWalletV2.on('stateChange', state => console.log(state));
</script>