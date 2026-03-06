/**
 * Wallet Connect Widget — Infinite Drive
 * Embeddable widget to connect EIP-1193 wallets to Infinite Drive (mainnet/testnet/creative).
 * Architecture: Core (logic, no DOM) | UI (presentation) | Bridge (orchestration).
 * Stable contract: window.DriveWallet, callbacks, config options — see ARCHITECTURE.md.
 * Flow follows EIP-1102, EIP-1193, EIP-3085, EIP-3326, EIP-6963 and MetaMask docs — see WALLET_CONNECT_OFFICIAL_AUDIT.md.
 */
(function () {
  'use strict';

  var PREFIX = 'drive-wc-';
  var STORAGE_KEY = 'drive-wallet-session';
  var NETWORKS = ['mainnet', 'testnet', 'creative'];
  var THEMES = ['base', 'light', 'dark'];
  var scriptEl = document.currentScript;

  var DEBUG = !!(window.DriveWalletWidget && window.DriveWalletWidget.debug);
  function log(msg, data) {
    if (DEBUG && console && typeof console.log === 'function') {
      console.log('[DriveWallet]', msg, data !== undefined ? data : '');
    }
  }
  function warn(msg, data) {
    if (console && typeof console.warn === 'function') {
      console.warn('[DriveWallet]', msg, data !== undefined ? data : '');
    }
  }
  function info(msg, data) {
    if (console && typeof console.info === 'function') {
      console.info('[DriveWallet]', msg, data !== undefined ? data : '');
    }
  }

  // =============================================================================
  // EIP-6963: Multi Injected Provider Discovery (official MetaMask recommendation)
  // Provider via eip6963:announceProvider avoids window.ethereum conflicts/SES issues.
  // =============================================================================
  var eip6963Provider = null;
  var eip6963Providers = {};

  function isMetaMaskEIP6963(info) {
    if (!info) return false;
    var rdns = (info.rdns || '').toLowerCase();
    var name = (info.name || '').toLowerCase();
    return rdns === 'io.metamask' || rdns.indexOf('io.metamask.') === 0 || name.indexOf('metamask') !== -1;
  }

  window.addEventListener('eip6963:announceProvider', function (event) {
    var detail = event.detail;
    if (!detail || !detail.info || !detail.provider) return;
    var uuid = detail.info.uuid;
    if (!uuid) return;
    eip6963Providers[uuid] = { info: detail.info, provider: detail.provider };
    if (isMetaMaskEIP6963(detail.info)) {
      eip6963Provider = detail.provider;
      log('EIP-6963: MetaMask provider announced', { rdns: detail.info.rdns, name: detail.info.name });
    }
  });

  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // =============================================================================
  // CONFIG & CONTAINER DISCOVERY (used by Bridge only)
  // =============================================================================

  function getScript() {
    return scriptEl;
  }

  function findContainer(script, targetId, network) {
    var el = document.querySelector('[data-drive-widget="wallet-connect"]');
    if (el) return el;
    if (targetId && targetId.indexOf(',') === -1) {
      el = document.getElementById(targetId);
      if (el) return el;
    }
    el = document.querySelector('[data-network="' + network + '"]');
    if (el) return el;
    el = document.querySelector('[data-network]');
    return el || null;
  }

  function findContainers(script, targetId, network) {
    if (!targetId || targetId.indexOf(',') === -1) return null;
    var ids = targetId.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var list = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) {
        var t = (el.getAttribute('data-theme') || 'base').toLowerCase();
        list.push({ el: el, theme: THEMES.indexOf(t) !== -1 ? t : 'base' });
      }
    }
    return list.length > 0 ? list : null;
  }

  // Script tag = data/logic (network, targetId). Container (div) = UI (theme, buttonLabel). Global overrides when present.
  function getConfig() {
    var globalConfig = window.DriveWalletWidget || {};
    var script = getScript();
    var network = (globalConfig.network || (script && script.getAttribute('data-network')) || 'mainnet').toLowerCase();
    if (NETWORKS.indexOf(network) === -1) network = 'mainnet';

    var targetId = globalConfig.targetId || (script && script.getAttribute('data-target-id')) || '';
    var containers = findContainers(script, targetId, network);
    var container = null;
    var theme = 'base';
    if (containers && containers.length > 0) {
      container = containers[0].el;
      theme = containers[0].theme;
    } else {
      container = findContainer(script, targetId, network);
      theme = (globalConfig.theme || (container && container.getAttribute('data-theme')) || 'base').toLowerCase();
    }
    if (THEMES.indexOf(theme) === -1) theme = 'base';

    return {
      network: network,
      targetId: targetId,
      container: container,
      containers: containers,
      theme: theme,
      buttonLabel: globalConfig.buttonLabel || (container && container.getAttribute('data-button-label')) || 'Connect to Infinite Drive',
      callbacks: {
        onReady: typeof globalConfig.onReady === 'function' ? globalConfig.onReady : null,
        onConnect: typeof globalConfig.onConnect === 'function' ? globalConfig.onConnect : null,
        onDisconnect: typeof globalConfig.onDisconnect === 'function' ? globalConfig.onDisconnect : null,
        onError: typeof globalConfig.onError === 'function' ? globalConfig.onError : null,
        onAccountsChanged: typeof globalConfig.onAccountsChanged === 'function' ? globalConfig.onAccountsChanged : null,
        onChainChanged: typeof globalConfig.onChainChanged === 'function' ? globalConfig.onChainChanged : null
      }
    };
  }

  function forEachContainer(config, fn) {
    if (config.containers && config.containers.length > 0) {
      for (var i = 0; i < config.containers.length; i++) {
        var c = config.containers[i];
        var cfg = { network: config.network, targetId: config.targetId, container: c.el, containers: config.containers, theme: c.theme, buttonLabel: config.buttonLabel, callbacks: config.callbacks };
        fn(c.el, cfg);
      }
    } else if (config.container) {
      fn(config.container, config);
    }
  }

  // =============================================================================
  // CORE — Logic only (no DOM, no render). Stable contract: state + start/connect/disconnect.
  // =============================================================================

  var core = (function () {
    var state = {
      connected: false,
      address: null,
      chainId: null,
      chainIdHex: null,
      networkName: null,
      environment: null,
      provider: null,
      _accountsHandler: null,
      _chainHandler: null
    };
    var _onStateChange = null;

    function saveSession(network, address, chainIdHex, networkName) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ network: network, address: address, chainId: chainIdHex, networkName: networkName }));
      } catch (e) {}
    }

    function getSession() {
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function clearSession() {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }

    function getNetworkDataUrl(network) {
      var script = getScript();
      if (!script || !script.src) return '';
      try {
        return new URL('../../' + network + '/network-data.json', script.src).href;
      } catch (e) {
        return '';
      }
    }

    function deriveDecimals(nativeCurrency) {
      if (!nativeCurrency || !nativeCurrency.denom_units || !nativeCurrency.denom_units.length) return 18;
      var units = nativeCurrency.denom_units;
      var with18 = units.filter(function (u) { return u.exponent === 18; })[0];
      if (with18) return 18;
      var max = units.reduce(function (acc, u) { return u.exponent > acc ? u.exponent : acc; }, 0);
      return max;
    }

    function buildAddChainParams(data) {
      if (!data) return null;
      var nc = data.native_currency || {};
      var decimals = deriveDecimals(nc);
      var rpc = (data.endpoints && data.endpoints['json-rpc-http']) || [];
      var primaryRpc = rpc.filter(function (e) { return e.primary; })[0] || rpc[0];
      var rpcUrl = primaryRpc && primaryRpc.url ? primaryRpc.url : '';
      var explorers = (data.explorers || []).map(function (e) { return e.url; }).filter(Boolean);
      var evmChainId = data.evm_chain_id != null ? data.evm_chain_id : 0;
      return {
        chainId: data.evm_chain_id != null ? data.evm_chain_id : null,
        chainIdHex: '0x' + Number(evmChainId).toString(16),
        environment: data.environment != null ? data.environment : null,
        chainName: data.name || data.evm_chain_name || 'Infinite Drive',
        nativeCurrency: {
          name: nc.name || nc.display || 'Improbability',
          symbol: nc.symbol || '42',
          decimals: decimals
        },
        rpcUrls: rpcUrl ? [rpcUrl] : [],
        blockExplorerUrls: explorers.length ? explorers : undefined
      };
    }

    function getProvider() {
      if (eip6963Provider) return eip6963Provider;
      var uuids = Object.keys(eip6963Providers);
      if (uuids.length > 0) return eip6963Providers[uuids[0]].provider;
      var ethereum = window.ethereum;
      if (!ethereum) return null;
      if (Array.isArray(ethereum)) {
        for (var i = 0; i < ethereum.length; i++) {
          if (ethereum[i] && ethereum[i].isMetaMask === true) return ethereum[i];
        }
        return ethereum[0] || null;
      }
      return ethereum;
    }

    function chainIdToHex(chainId) {
      if (chainId == null) return null;
      if (typeof chainId === 'string' && chainId.startsWith('0x')) return chainId;
      var n = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
      return isNaN(n) ? null : '0x' + n.toString(16);
    }

    function chainIdHexEqual(a, b) {
      if (a == null || b == null) return a === b;
      var na = typeof a === 'string' && a.startsWith('0x') ? parseInt(a, 16) : (typeof a === 'string' ? parseInt(a, 10) : a);
      var nb = typeof b === 'string' && b.startsWith('0x') ? parseInt(b, 16) : (typeof b === 'string' ? parseInt(b, 10) : b);
      return !isNaN(na) && !isNaN(nb) && na === nb;
    }

    function syncDriveWallet() {
      window.DriveWallet = {
        connected: state.connected,
        address: state.address,
        chainId: state.chainId,
        chainIdHex: state.chainIdHex,
        networkName: state.networkName,
        environment: state.environment,
        provider: state.provider
      };
    }

    function emit(cb, arg) {
      if (cb) try { cb(arg); } catch (e) { console.error('[DriveWallet] callback error', e); }
    }

    function removeProviderEvents() {
      var provider = state.provider;
      if (!provider) return;
      if (state._accountsHandler) {
        provider.removeListener('accountsChanged', state._accountsHandler);
        state._accountsHandler = null;
      }
      if (state._chainHandler) {
        provider.removeListener('chainChanged', state._chainHandler);
        state._chainHandler = null;
      }
    }

    function setupProviderEvents(chainParams, coreConfig) {
      var provider = state.provider;
      if (!provider) return;
      removeProviderEvents();
      log('provider events: on(accountsChanged, chainChanged)');
      state._accountsHandler = function (accounts) {
        log('accountsChanged (EIP-1193)', { count: accounts ? accounts.length : 0 });
        if (!accounts || !accounts.length) {
          removeProviderEvents();
          state.connected = false;
          state.address = null;
          state.chainId = null;
          state.chainIdHex = null;
          state.networkName = null;
          state.environment = null;
          state.provider = null;
          state._accountsHandler = null;
          state._chainHandler = null;
          clearSession();
          syncDriveWallet();
          if (_onStateChange) _onStateChange(getState());
          emit(coreConfig.callbacks.onDisconnect);
        } else {
          state.address = accounts[0];
          saveSession(coreConfig.network, state.address, state.chainIdHex, state.networkName);
          syncDriveWallet();
          if (_onStateChange) _onStateChange(getState());
        }
        emit(coreConfig.callbacks.onAccountsChanged, accounts || []);
      };
      state._chainHandler = function (id) {
        log('chainChanged (EIP-1193)', { chainId: chainIdToHex(id) });
        state.chainId = null;
        state.chainIdHex = chainIdToHex(id);
        state.networkName = null;
        state.environment = null;
        saveSession(coreConfig.network, state.address, state.chainIdHex, state.networkName);
        syncDriveWallet();
        if (_onStateChange) _onStateChange(getState());
        emit(coreConfig.callbacks.onChainChanged, state.chainIdHex);
      };
      provider.on('accountsChanged', state._accountsHandler);
      provider.on('chainChanged', state._chainHandler);
    }

    function getState() {
      return {
        connected: state.connected,
        address: state.address,
        chainId: state.chainId,
        chainIdHex: state.chainIdHex,
        networkName: state.networkName,
        environment: state.environment,
        provider: state.provider
      };
    }

    function init(options) {
      _onStateChange = options && options.onStateChange || null;
    }

    function start(coreConfig, callbacks) {
      log('start()', { network: coreConfig.network });
      var networkPath = getNetworkDataUrl(coreConfig.network);
      if (!networkPath) {
        warn('start: no network data URL');
        if (callbacks.onError) callbacks.onError(new Error('Network data URL'));
        return Promise.reject(new Error('Network data URL'));
      }
      var provider = getProvider();
      var session = getSession();
      var wantRestore = session && session.network === coreConfig.network && provider;
      log('start: fetch + (restore check)', { wantRestore: wantRestore, hasSession: !!session });
      var accountsPromise = wantRestore ? provider.request({ method: 'eth_accounts' }) : Promise.resolve([]);
      var chainIdPromise = wantRestore ? provider.request({ method: 'eth_chainId' }) : Promise.resolve(null);
      var fetchPromise = fetch(networkPath).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      });

      return Promise.all([fetchPromise, accountsPromise, chainIdPromise])
        .then(function (results) {
          var data = results[0];
          var accounts = results[1];
          var currentChainId = results[2];
          var chainParams = buildAddChainParams(data);
          if (!chainParams) {
            warn('start: invalid network data');
            if (callbacks.onError) callbacks.onError(new Error('Invalid network data'));
            return;
          }
          log('start: network data loaded', { chainIdHex: chainParams.chainIdHex, rpcUrlsCount: (chainParams.rpcUrls && chainParams.rpcUrls.length) || 0 });
          if (!provider) {
            log('start: no provider, onReady (no wallet)');
            if (callbacks.onReady) callbacks.onReady(getState(), chainParams);
            return;
          }

          if (wantRestore && accounts && accounts.length > 0 && currentChainId != null) {
            var currentHex = chainIdToHex(currentChainId);
            var sameChain = chainIdHexEqual(currentHex, chainParams.chainIdHex);
            log('start: restore check', { sameChain: sameChain, currentHex: currentHex, targetHex: chainParams.chainIdHex });
            if (!sameChain) {
              log('start: chain mismatch, clear session — user must click Connect to switch');
              clearSession();
            } else {
              state.connected = true;
              state.address = accounts[0];
              state.chainId = chainParams.chainId;
              state.chainIdHex = chainParams.chainIdHex;
              state.networkName = session.networkName || chainParams.chainName;
              state.environment = chainParams.environment;
              state.provider = provider;
              syncDriveWallet();
              setupProviderEvents(chainParams, coreConfig);
              if (_onStateChange) _onStateChange(getState());
              log('start: session restored', { address: state.address ? state.address.slice(0, 10) + '...' : '' });
            }
          } else {
            if (session && session.network === coreConfig.network) clearSession();
          }
          log('start: onReady', { connected: getState().connected });
          if (callbacks.onReady) callbacks.onReady(getState(), chainParams);
        })
        .catch(function (err) {
          if (callbacks.onError) callbacks.onError(err);
          throw err;
        });
    }

    function connect(chainParams, coreConfig) {
      info('Connect clicked — network: ' + coreConfig.network + ', chainId: ' + chainParams.chainIdHex);
      log('connect() called', { network: coreConfig.network, chainIdHex: chainParams.chainIdHex });
      var provider = getProvider();
      var providerSource = eip6963Provider && provider === eip6963Provider ? 'eip6963' : 'legacy';
      log('provider', {
        source: providerSource,
        isMetaMask: !!(provider && provider.isMetaMask),
        providersCount: Array.isArray(window.ethereum) ? window.ethereum.length : 1
      });
      if (!provider) {
        warn('connect: no provider (EIP-6963 or window.ethereum)', null);
        if (coreConfig.callbacks.onError) coreConfig.callbacks.onError(new Error('No wallet'));
        return Promise.reject(new Error('No wallet'));
      }
      // EIP-3326 / EIP-3085: chainId as hex string.
      // Flow order for SES/lockdown compatibility: request accounts first to "activate" the provider
      // (establishes postMessage channel with extension), then switch chain. See WALLET_CONNECT_OFFICIAL_AUDIT.md.
      var chainIdHex = String(chainParams.chainIdHex);

      function setStateFromAccounts(account) {
        state.connected = true;
        state.address = account;
        state.chainId = chainParams.chainId;
        state.chainIdHex = chainParams.chainIdHex;
        state.networkName = chainParams.chainName;
        state.environment = chainParams.environment;
        state.provider = provider;
        saveSession(coreConfig.network, state.address, state.chainIdHex, state.networkName);
        syncDriveWallet();
        setupProviderEvents(chainParams, coreConfig);
        if (_onStateChange) _onStateChange(getState());
        emit(coreConfig.callbacks.onConnect, { address: state.address, chainId: state.chainId, chainIdHex: state.chainIdHex, networkName: state.networkName, environment: state.environment });
        info('Connected. If your wallet still shows a different network, switch it manually in MetaMask, or embed this widget in an iframe that does not run SES/lockdown.');
      }

      function ensureChainThenSetState(account) {
        var CHAIN_CHANGED_TIMEOUT_MS = 5000;
        return provider.request({ method: 'eth_chainId' }).then(function (actualId) {
          var actualHex = chainIdToHex(actualId);
          log('eth_chainId after requestAccounts', { current: actualHex, target: chainIdHex });
          if (chainIdHexEqual(actualHex, chainIdHex)) {
            log('Already on target chain', { chainIdHex: chainIdHex });
            setStateFromAccounts(account);
            return;
          }
          // MetaMask docs: "Listen to the chainChanged event to detect a user's network change."
          // Only mark connected when we receive chainChanged with target chainId (real UI state).
          return new Promise(function (resolve, reject) {
            var settled = false;
            function settle() {
              if (settled) return;
              settled = true;
              try { provider.removeListener('chainChanged', onChainChanged); } catch (e) {}
              if (timeoutId) clearTimeout(timeoutId);
            }
            var timeoutId = setTimeout(function () {
              settle();
              var err = new Error('No se recibió confirmación de cambio de red (evento chainChanged). Cambia la red manualmente en MetaMask o prueba sin extensiones que inyecten SES.');
              warn(err.message, null);
              if (_onStateChange) _onStateChange(getState());
              emit(coreConfig.callbacks.onError, err);
              reject(err);
            }, CHAIN_CHANGED_TIMEOUT_MS);
            function onChainChanged(newChainId) {
              var newHex = chainIdToHex(newChainId);
              if (chainIdHexEqual(newHex, chainIdHex)) {
                log('chainChanged (EIP-1193): red cambiada realmente en MetaMask', { chainId: newHex });
                settle();
                setStateFromAccounts(account);
                resolve();
              }
            }
            provider.on('chainChanged', onChainChanged);
            info('Requesting wallet to switch chain (popup expected) — confirmación vía evento chainChanged');
            log('calling wallet_switchEthereumChain (EIP-3326)', { chainId: chainIdHex });
            function doSwitch() {
              return provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }]
              });
            }
            function doAddThenSwitch() {
              if (!chainParams.rpcUrls || chainParams.rpcUrls.length === 0) {
                settle();
                var errMsg = 'Network has no RPC URL; cannot add chain (EIP-3085 requires rpcUrls).';
                warn(errMsg, null);
                emit(coreConfig.callbacks.onError, new Error(errMsg));
                reject(new Error(errMsg));
                return;
              }
              info('Chain not in wallet; requesting add then switch — chainId: ' + chainIdHex);
              return provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: chainIdHex,
                  chainName: chainParams.chainName,
                  nativeCurrency: chainParams.nativeCurrency,
                  rpcUrls: chainParams.rpcUrls,
                  blockExplorerUrls: chainParams.blockExplorerUrls
                }]
              }).then(doSwitch);
            }
            doSwitch().catch(function (switchErr) {
              var code = switchErr && (switchErr.code || (switchErr.error && switchErr.error.code));
              log('wallet_switchEthereumChain result', { code: code, message: switchErr && switchErr.message });
              if (code === 4902) {
                doAddThenSwitch().catch(function (addErr) {
                  settle();
                  warn('add/switch chain failed', { code: addErr && addErr.code, message: addErr && addErr.message });
                  if (_onStateChange) _onStateChange(getState());
                  emit(coreConfig.callbacks.onError, addErr);
                  reject(addErr);
                });
              } else {
                settle();
                warn('wallet_switchEthereumChain error', { code: code, message: switchErr && switchErr.message });
                if (_onStateChange) _onStateChange(getState());
                emit(coreConfig.callbacks.onError, switchErr);
                reject(switchErr);
              }
            });
          });
        });
      }

      // 1. Request accounts first (EIP-1102) — in SES/lockdown this can "activate" the provider so
      // subsequent wallet_switchEthereumChain actually reaches the extension.
      info('Requesting account access (popup expected)');
      log('requestAccounts (EIP-1102) first');
      return provider.request({ method: 'eth_requestAccounts' })
        .then(function (accounts) {
          if (!accounts || !accounts.length) {
            warn('requestAccounts: no accounts returned');
            emit(coreConfig.callbacks.onError, new Error('No accounts'));
            return;
          }
          log('requestAccounts success', { address: accounts[0] ? accounts[0].slice(0, 10) + '...' : '' });
          return ensureChainThenSetState(accounts[0]);
        })
        .catch(function (err) {
          warn('connect flow error', { message: err && err.message, code: err && err.code });
          if (_onStateChange) _onStateChange(getState());
          emit(coreConfig.callbacks.onError, err);
        });
    }

    function disconnect(coreConfig) {
      removeProviderEvents();
      state.connected = false;
      state.address = null;
      state.chainId = null;
      state.chainIdHex = null;
      state.networkName = null;
      state.environment = null;
      state.provider = null;
      state._accountsHandler = null;
      state._chainHandler = null;
      clearSession();
      syncDriveWallet();
      if (_onStateChange) _onStateChange(getState());
      emit(coreConfig.callbacks.onDisconnect);
    }

    return {
      getState: getState,
      syncDriveWallet: syncDriveWallet,
      getNetworkDataUrl: getNetworkDataUrl,
      buildAddChainParams: buildAddChainParams,
      getProvider: getProvider,
      getSession: getSession,
      clearSession: clearSession,
      init: init,
      start: start,
      connect: connect,
      disconnect: disconnect
    };
  })();

  // =============================================================================
  // UI — Presentation only (themes, styles, DOM). No connection/session logic.
  // Input: container, uiConfig (theme, buttonLabel, network), optional state snapshot & chainParams.
  // =============================================================================

  function escapeAttr(s) {
    if (s == null || s === '') return '';
    var str = String(s);
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function truncateAddress(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '\u2026' + addr.slice(-4);
  }

  function shortNetworkLabel(network, networkName) {
    if (network === 'mainnet') return 'Main';
    if (network === 'testnet') return 'Test';
    if (network === 'creative') return 'Creative';
    if (networkName && networkName.length <= 8) return networkName;
    return network || 'Net';
  }

  var stylesInjected = false;
  function ensureStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
      '.' + PREFIX + 'root{ font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.4; transition: opacity 0.15s ease; }' +
      '.' + PREFIX + 'message{ padding: 0.5rem 0; margin: 0; }' +
      '.' + PREFIX + 'button{ display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.25rem; cursor: pointer; font-size: 0.95rem; font-weight: 500; border: none; border-radius: 10px; transition: transform 0.1s ease, box-shadow 0.15s ease; }' +
      '.' + PREFIX + 'button:hover{ transform: translateY(-1px); }' +
      '.' + PREFIX + 'button:active{ transform: translateY(0); }' +
      '.' + PREFIX + 'button:disabled{ opacity: 0.6; cursor: not-allowed; transform: none; }' +
      '.' + PREFIX + 'connected{ display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 10px; max-width: 20em; min-height: 2.75rem; box-sizing: border-box; }' +
      '.' + PREFIX + 'connected-dot{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }' +
      '.' + PREFIX + 'address{ font-family: ui-monospace, monospace; font-size: 0.875em; padding: 0.2em 0; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 8em; }' +
      '.' + PREFIX + 'net{ font-size: 0.75rem; font-weight: 500; padding: 0.15em 0.45em; border-radius: 6px; flex-shrink: 0; }' +
      '.' + PREFIX + 'disconnect{ font-size: 0.8rem; cursor: pointer; text-decoration: none; border-radius: 4px; padding: 0.2em 0.35em; margin-left: auto; flex-shrink: 0; transition: opacity 0.15s ease; }' +
      '.' + PREFIX + 'disconnect:hover{ opacity: 0.85; }' +
      '/* theme: base */' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'message{ color: #374151; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'button{ background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%); color: #fff; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35); }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'button:hover{ box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45); }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'connected{ background: #f0f4ff; border: 1px solid #c7d2fe; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'connected-dot{ background: #22c55e; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'address{ color: #3730a3; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'net{ background: #e0e7ff; color: #4338ca; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'disconnect{ color: #6b7280; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'disconnect:hover{ color: #374151; }' +
      '/* theme: light */' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'message{ color: #4b5563; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'button{ background: #fff; color: #111827; border: 2px solid #d1d5db; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'button:hover{ border-color: #9ca3af; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'connected{ background: #f9fafb; border: 1px solid #e5e7eb; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'connected-dot{ background: #16a34a; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'address{ color: #1f2937; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'net{ background: #e5e7eb; color: #374151; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'disconnect{ color: #6b7280; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'disconnect:hover{ color: #111827; }' +
      '/* theme: dark */' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'message{ color: #9ca3af; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'button{ background: linear-gradient(180deg, #4b5563 0%, #374151 100%); color: #f9fafb; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'button:hover{ background: linear-gradient(180deg, #6b7280 0%, #4b5563 100%); box-shadow: 0 4px 12px rgba(0,0,0,0.35); }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'connected{ background: rgba(55, 65, 81, 0.6); border: 1px solid #4b5563; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'connected-dot{ background: #4ade80; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'address{ color: #e5e7eb; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'net{ background: #4b5563; color: #d1d5db; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'disconnect{ color: #9ca3af; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'disconnect:hover{ color: #f3f4f6; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'message[style*="color:#c00"]{ color: #f87171 !important; }';
    (document.head || document.documentElement).appendChild(style);
  }

  function setTheme(root, theme) {
    if (root && theme) root.setAttribute('data-theme', theme);
  }

  function renderLoading(container, uiConfig) {
    ensureStyles();
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    setTheme(root, uiConfig.theme);
    root.innerHTML = '<p class="' + PREFIX + 'message">Loading network\u2026</p>';
    container.innerHTML = '';
    container.appendChild(root);
  }

  function renderNoWallet(container, uiConfig) {
    ensureStyles();
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    setTheme(root, uiConfig.theme);
    root.innerHTML = '<p class="' + PREFIX + 'message">Install MetaMask or an EVM-compatible wallet to connect.</p>';
    container.innerHTML = '';
    container.appendChild(root);
  }

  function renderError(container, uiConfig, message) {
    ensureStyles();
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    setTheme(root, uiConfig.theme);
    root.innerHTML = '<p class="' + PREFIX + 'message" style="color:#c00">' + escapeAttr(message || 'Something went wrong.') + '</p>';
    container.innerHTML = '';
    container.appendChild(root);
  }

  function renderReady(container, uiConfig, chainParams, onConnect) {
    ensureStyles();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = PREFIX + 'button';
    btn.textContent = uiConfig.buttonLabel;
    btn.addEventListener('click', function () { onConnect(); });
    container.innerHTML = '';
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    setTheme(root, uiConfig.theme);
    root.appendChild(btn);
    container.appendChild(root);
  }

  function renderConnected(container, uiConfig, chainParams, stateSnapshot, onDisconnect) {
    ensureStyles();
    var addr = truncateAddress(stateSnapshot.address);
    var netShort = shortNetworkLabel(uiConfig.network, stateSnapshot.networkName);
    var titleSafe = escapeAttr(stateSnapshot.address || '');
    var netTitle = escapeAttr(stateSnapshot.networkName || stateSnapshot.chainIdHex || stateSnapshot.chainId || '');
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    setTheme(root, uiConfig.theme);
    root.innerHTML =
      '<div class="' + PREFIX + 'connected">' +
      '<span class="' + PREFIX + 'connected-dot" aria-hidden="true"></span>' +
      '<span class="' + PREFIX + 'address" title="' + titleSafe + '">' + escapeAttr(addr) + '</span>' +
      '<span class="' + PREFIX + 'net" title="' + netTitle + '">' + escapeAttr(netShort) + '</span>' +
      '<a class="' + PREFIX + 'disconnect" href="#" role="button">Disconnect</a>' +
      '</div>';
    var disconnectLink = root.querySelector('.' + PREFIX + 'disconnect');
    disconnectLink.addEventListener('click', function (e) {
      e.preventDefault();
      onDisconnect();
    });
    container.innerHTML = '';
    container.appendChild(root);
  }

  // =============================================================================
  // BRIDGE — Orchestrates Core + UI. Binds onStateChange to re-render.
  // =============================================================================

  function run() {
    var config = getConfig();
    if (!config.container) {
      warn('run: no container found');
      return;
    }
    info('Widget init — network: ' + config.network + ' (set window.DriveWalletWidget.debug = true for more logs)');
    log('run()', { network: config.network, hasContainer: true });
    var coreConfig = { network: config.network, callbacks: config.callbacks };
    var chainParamsRef = { current: null };

    core.init({
      onStateChange: function (stateSnapshot) {
        if (!chainParamsRef.current) return;
        forEachContainer(config, function (el, uiConfig) {
          if (stateSnapshot.connected) {
            renderConnected(el, uiConfig, chainParamsRef.current, stateSnapshot, function () { core.disconnect(coreConfig); });
          } else {
            renderReady(el, uiConfig, chainParamsRef.current, function () { core.connect(chainParamsRef.current, coreConfig); });
          }
        });
      }
    });

    core.syncDriveWallet();
    var provider = core.getProvider();
    var networkPath = core.getNetworkDataUrl(config.network);
    if (!networkPath) {
      forEachContainer(config, function (el, uiConfig) { renderError(el, uiConfig, 'Could not resolve network data URL.'); });
      if (config.callbacks.onError) config.callbacks.onError(new Error('Network data URL'));
      return;
    }

    forEachContainer(config, function (el, uiConfig) { renderLoading(el, uiConfig); });

    core.start(coreConfig, {
      onReady: function (stateSnapshot, chainParams) {
        chainParamsRef.current = chainParams;
        if (config.callbacks.onReady) config.callbacks.onReady();
        if (!provider) {
          forEachContainer(config, function (el, uiConfig) { renderNoWallet(el, uiConfig); });
          return;
        }
        forEachContainer(config, function (el, uiConfig) {
          if (stateSnapshot.connected) {
            renderConnected(el, uiConfig, chainParams, stateSnapshot, function () { core.disconnect(coreConfig); });
          } else {
            renderReady(el, uiConfig, chainParams, function () { core.connect(chainParams, coreConfig); });
          }
        });
      },
      onError: function (err) {
        handleRunError(err, networkPath, config, provider);
      }
    }).catch(function () {});
  }

  function handleRunError(err, networkPath, config, provider) {
    core.clearSession();
    var isFetchError = err.message && (err.message.indexOf('status') !== -1 || err.message.indexOf('Failed') !== -1);
    if (isFetchError) {
      forEachContainer(config, function (el, uiConfig) { renderError(el, uiConfig, 'Failed to load network: ' + (err.message || String(err))); });
    } else {
      fetch(networkPath)
        .then(function (r) {
          if (!r.ok) return Promise.reject(new Error(r.status));
          return r.json();
        })
        .then(function (data) {
          var chainParams = core.buildAddChainParams(data);
          if (chainParams && provider) {
            forEachContainer(config, function (el, uiConfig) { renderReady(el, uiConfig, chainParams, function () { core.connect(chainParams, { network: config.network, callbacks: config.callbacks }); }); });
          } else if (!provider) {
            forEachContainer(config, function (el, uiConfig) { renderNoWallet(el, uiConfig); });
          } else {
            forEachContainer(config, function (el, uiConfig) { renderError(el, uiConfig, 'Invalid network data.'); });
          }
        })
        .catch(function () {
          forEachContainer(config, function (el, uiConfig) { renderError(el, uiConfig, 'Failed to load network.'); });
        });
    }
    if (config.callbacks.onError) config.callbacks.onError(err);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
