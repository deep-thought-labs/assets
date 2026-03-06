// Wallet Connect v2 (CROC) – Implementación 100% oficial
// EIP-6963 + EIP-1193 + EIP-3326 + EIP-3085 + EIP-1102
// Lee los mismos JSONs que tu widget original

const DriveWalletV2 = (function () {
    let provider = null;
    let currentState = { connected: false, accounts: [], chainIdHex: null, networkName: null };
    let listeners = {};
    let networkData = null;
    const scriptElement = document.currentScript;
  
    // 1. Provider vía EIP-6963 (recomendado por MetaMask)
    async function discoverProvider() {
      return new Promise((resolve) => {
        const handler = (event) => {
          const { provider: p, info } = event.detail;
          if (info.rdns === 'io.metamask' || info.name.toLowerCase().includes('metamask')) {
            provider = p;
            window.removeEventListener('eip6963:announceProvider', handler);
            resolve(provider);
          }
        };
        window.addEventListener('eip6963:announceProvider', handler);
        window.dispatchEvent(new Event('eip6963:requestProvider'));
      });
    }
  
    // 2. Cargar datos de red (mainnet o testnet)
    async function loadNetworkData() {
      const network = (scriptElement?.getAttribute('data-network') || 'mainnet').toLowerCase();
      const url = new URL(`../../${network}/network-data.json`, scriptElement.src).href;
      const res = await fetch(url);
      const raw = await res.json();
  
      const rpcUrls = raw.endpoints?.['json-rpc-http']?.map(e => e.url) || [];
      const explorerUrls = raw.explorers?.filter(e => e.primary).map(e => e.url) || [];
  
      networkData = {
        evm_chain_id_hex: raw.evm_chain_id_hex,
        name: raw.name,
        addChainParams: {
          chainId: raw.evm_chain_id_hex,
          chainName: raw.name,
          nativeCurrency: {
            name: raw.native_currency.name,
            symbol: raw.native_currency.symbol,
            decimals: 18
          },
          rpcUrls,
          blockExplorerUrls: explorerUrls.length ? explorerUrls : undefined
        }
      };
    }
  
    // 3. Actualizar estado REAL desde MetaMask
    async function updateState() {
      if (!provider) return;
      try {
        const [accounts, chainId] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' })
        ]);
  
        const isConnected = accounts.length > 0 && chainId.toLowerCase() === networkData.evm_chain_id_hex.toLowerCase();
  
        currentState = {
          connected: isConnected,
          accounts,
          chainIdHex: chainId,
          networkName: isConnected ? networkData.name : null
        };
  
        emit('stateChange', currentState);
      } catch (e) {
        console.warn('[DriveWalletV2] updateState error', e);
      }
    }
  
    // 4. Listeners oficiales (detecta cambios manuales en MetaMask y refrescos)
    function setupEvents() {
      provider.on('chainChanged', updateState);
      provider.on('accountsChanged', updateState);
      provider.on('disconnect', () => {
        currentState.connected = false;
        emit('stateChange', currentState);
      });
    }
  
    // 5. Conectar (flujo oficial)
    async function connect() {
      if (!provider) await discoverProvider();
      if (!networkData) await loadNetworkData();
  
      await provider.request({ method: 'eth_requestAccounts' });
  
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkData.evm_chain_id_hex }]
        });
      } catch (err) {
        if (err.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [networkData.addChainParams]
          });
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: networkData.evm_chain_id_hex }]
          });
        } else throw err;
      }
  
      await updateState();
      return currentState;
    }
  
    function disconnect() {
      currentState.connected = false;
      currentState.accounts = [];
      emit('stateChange', currentState);
    }
  
    function getState() {
      return { ...currentState };
    }
  
    function on(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }
  
    function emit(event, data) {
      (listeners[event] || []).forEach(cb => cb(data));
    }
  
    // Inicialización automática al cargar el script
    (async () => {
      await discoverProvider();
      await loadNetworkData();
      setupEvents();
      await updateState(); // ← Detecta estado real incluso después de refresh
    })();
  
    return { connect, disconnect, getState, on };
  })();