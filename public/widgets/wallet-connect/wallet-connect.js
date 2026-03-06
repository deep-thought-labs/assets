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

    var tokenContracts = [];
    if (Array.isArray(globalConfig.tokenContracts) && globalConfig.tokenContracts.length > 0) {
      tokenContracts = globalConfig.tokenContracts.map(function (a) { return String(a).trim(); }).filter(Boolean);
    } else {
      var attrContracts = (script && script.getAttribute('data-token-contracts')) || (container && container.getAttribute('data-token-contracts')) || '';
      if (attrContracts) tokenContracts = attrContracts.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (tokenContracts.length === 0 && network === 'testnet') {
      tokenContracts = ['0xdacD1C99ffe47E63fc6C1a41C7306e559Eb3A6fa'];
    }
    var layout = (globalConfig.layout || (script && script.getAttribute('data-layout')) || (container && container.getAttribute('data-layout')) || 'inline').toLowerCase();
    if (layout !== 'dropdown') layout = 'inline';
    // Future: if globalConfig.tokenContractsUrl is set, fetch JSON (array of addresses) and use as tokenContracts
    return {
      network: network,
      targetId: targetId,
      container: container,
      containers: containers,
      theme: theme,
      layout: layout,
      buttonLabel: globalConfig.buttonLabel || (container && container.getAttribute('data-button-label')) || 'Connect to Infinite Drive',
      tokenContracts: tokenContracts,
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
        var cfg = { network: config.network, targetId: config.targetId, container: c.el, containers: config.containers, theme: c.theme, layout: config.layout, buttonLabel: config.buttonLabel, callbacks: config.callbacks };
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
      _chainHandler: null,
      nativeToken: null,
      tokenBalances: []
    };
    var _onStateChange = null;
    var ERC20 = { name: '0x06fdde03', symbol: '0x95d89b41', decimals: '0x313ce567', balanceOf: '0x70a08231' };

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
      var tokens = (state.tokenBalances || []).slice();
      var payload = {
        connected: state.connected,
        address: state.address,
        chainId: state.chainId,
        chainIdHex: state.chainIdHex,
        networkName: state.networkName,
        environment: state.environment,
        provider: state.provider,
        nativeToken: state.nativeToken,
        tokens: tokens,
        tokenBalances: tokens
      };
      payload.toJSON = function () {
        return {
          connected: state.connected,
          address: state.address,
          chainId: state.chainId,
          chainIdHex: state.chainIdHex,
          networkName: state.networkName,
          environment: state.environment,
          nativeToken: state.nativeToken,
          tokens: (state.tokenBalances || []).slice()
        };
      };
      window.DriveWallet = payload;
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
          // Usuario desconectó el sitio en MetaMask o revocó el permiso → mostramos estado desconectado
          removeProviderEvents();
          state.connected = false;
          state.address = null;
          state.chainId = null;
          state.chainIdHex = null;
          state.networkName = null;
          state.environment = null;
          state.provider = null;
          state.nativeToken = null;
          state.tokenBalances = [];
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
          refreshNativeBalance();
          if ((coreConfig.tokenContracts || []).length > 0) {
            refreshTokenBalances(coreConfig);
          }
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
        refreshNativeBalance();
        if ((coreConfig.tokenContracts || []).length > 0) {
          refreshTokenBalances(coreConfig);
        }
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
        provider: state.provider,
        nativeToken: state.nativeToken,
        tokenBalances: state.tokenBalances
      };
    }

    function padAddress(address) {
      var hex = (address || '').replace(/^0x/i, '').toLowerCase();
      if (hex.length > 64) hex = hex.slice(-64);
      return '0x' + hex.padStart(64, '0');
    }

    function ethCall(provider, to, data) {
      return provider.request({ method: 'eth_call', params: [{ to: to, data: data }, 'latest'] });
    }

    function parseUint256Hex(hex) {
      if (!hex || typeof hex !== 'string') return null;
      var h = hex.replace(/^0x/i, '');
      if (h.length > 64) h = h.slice(-64);
      return parseInt(h, 16);
    }

    function fetchTokenInfo(provider, contractAddress, userAddress) {
      var to = contractAddress;
      return Promise.all([
        ethCall(provider, to, ERC20.name),
        ethCall(provider, to, ERC20.symbol),
        ethCall(provider, to, ERC20.decimals),
        ethCall(provider, to, ERC20.balanceOf + padAddress(userAddress).slice(2))
      ]).then(function (results) {
        var nameHex = results[0];
        var symbolHex = results[1];
        var decimalsHex = results[2];
        var balanceRaw = parseUint256Hex(results[3]);
        var decimals = 18;
        if (decimalsHex) {
          var d = parseUint256Hex(decimalsHex);
          if (d != null && !isNaN(d)) decimals = d;
        }
        var name = '';
        var symbol = '';
        try {
          if (nameHex && nameHex.length > 2) name = decodeAbiString(nameHex);
          if (symbolHex && symbolHex.length > 2) symbol = decodeAbiString(symbolHex);
        } catch (e) {}
        var balance = balanceRaw != null && !isNaN(balanceRaw) ? balanceRaw / Math.pow(10, decimals) : 0;
        return { address: contractAddress, name: name || 'Token', symbol: symbol || '?', decimals: decimals, balanceRaw: balanceRaw, balance: balance };
      });
    }

    function decodeAbiString(hex) {
      if (!hex || typeof hex !== 'string') return '';
      var h = hex.replace(/^0x/i, '');
      if (h.length === 64) {
        return decodeBytes32Hex(h);
      }
      if (h.length < 130) return '';
      var offset = parseInt(h.slice(0, 64), 16);
      if (isNaN(offset)) return '';
      var lenStart = offset * 2;
      var len = parseInt(h.slice(lenStart, lenStart + 64), 16);
      if (isNaN(len) || len < 0 || len > 1024) return '';
      var strStart = lenStart + 64;
      var slice = h.slice(strStart, strStart + len * 2);
      var str = '';
      for (var i = 0; i < slice.length; i += 2) str += String.fromCharCode(parseInt(slice.slice(i, i + 2), 16));
      return str.replace(/\0+$/, '');
    }

    function decodeBytes32Hex(h) {
      if (!h || h.length < 64) return '';
      var str = '';
      for (var i = 0; i < 64; i += 2) {
        var code = parseInt(h.slice(i, i + 2), 16);
        if (code === 0) break;
        if (code < 32 || code > 126) continue;
        str += String.fromCharCode(code);
      }
      return str;
    }

    function refreshNativeBalance() {
      if (!state.provider || !state.address || !state.nativeToken) return Promise.resolve();
      return state.provider.request({ method: 'eth_getBalance', params: [state.address, 'latest'] })
        .then(function (hex) {
          var balanceRaw = parseUint256Hex(hex);
          var decimals = state.nativeToken.decimals;
          state.nativeToken.balanceRaw = balanceRaw;
          state.nativeToken.balance = balanceRaw != null && !isNaN(balanceRaw) ? balanceRaw / Math.pow(10, decimals) : 0;
          syncDriveWallet();
          if (_onStateChange) _onStateChange(getState());
        })
        .catch(function (err) {
          log('native balance fetch failed', err && err.message);
        });
    }

    function refreshTokenBalances(coreConfig) {
      var contracts = coreConfig && coreConfig.tokenContracts;
      if (!state.provider || !state.address || !contracts || contracts.length === 0) {
        state.tokenBalances = [];
        return Promise.resolve();
      }
      var promises = contracts.map(function (addr) {
        return fetchTokenInfo(state.provider, addr, state.address).catch(function (err) {
          log('token fetch failed', { contract: addr, message: err && err.message });
          return null;
        });
      });
      return Promise.all(promises).then(function (arr) {
        state.tokenBalances = arr.filter(Boolean);
        syncDriveWallet();
        if (_onStateChange) _onStateChange(getState());
      });
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
              state.nativeToken = chainParams.nativeCurrency ? { name: chainParams.nativeCurrency.name, symbol: chainParams.nativeCurrency.symbol, decimals: chainParams.nativeCurrency.decimals } : null;
              syncDriveWallet();
              setupProviderEvents(chainParams, coreConfig);
              if (_onStateChange) _onStateChange(getState());
              refreshNativeBalance();
              if ((coreConfig.tokenContracts || []).length > 0) {
                refreshTokenBalances(coreConfig);
              }
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
        state.nativeToken = chainParams.nativeCurrency ? { name: chainParams.nativeCurrency.name, symbol: chainParams.nativeCurrency.symbol, decimals: chainParams.nativeCurrency.decimals } : null;
        saveSession(coreConfig.network, state.address, state.chainIdHex, state.networkName);
        syncDriveWallet();
        setupProviderEvents(chainParams, coreConfig);
        if (_onStateChange) _onStateChange(getState());
        refreshNativeBalance();
        if ((coreConfig.tokenContracts || []).length > 0) {
          refreshTokenBalances(coreConfig);
        }
        emit(coreConfig.callbacks.onConnect, { address: state.address, chainId: state.chainId, chainIdHex: state.chainIdHex, networkName: state.networkName, environment: state.environment });
        info('Connected. If your wallet still shows a different network, switch it manually in MetaMask, or embed this widget in an iframe that does not run SES/lockdown.');
      }

      function doSwitch() {
        return provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
      }
      function doAddThenSwitch() {
        if (!chainParams.rpcUrls || chainParams.rpcUrls.length === 0) {
          return Promise.reject(new Error('Network has no RPC URL; cannot add chain (EIP-3085 requires rpcUrls).'));
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
      function ensureChainThenSetState(account) {
        return provider.request({ method: 'eth_chainId' }).then(function (currentId) {
          var currentHex = chainIdToHex(currentId);
          if (chainIdHexEqual(currentHex, chainIdHex)) {
            log('Already on target chain', { chainId: chainIdHex });
            setStateFromAccounts(account);
            return;
          }
          log('calling wallet_switchEthereumChain (EIP-3326)', { chainId: chainIdHex });
          return doSwitch()
            .then(function () { return provider.request({ method: 'eth_chainId' }); })
            .then(function (id) {
              if (chainIdHexEqual(chainIdToHex(id), chainIdHex)) {
                setStateFromAccounts(account);
              } else {
                setStateFromAccounts(account);
              }
            })
            .catch(function (switchErr) {
              var code = switchErr && (switchErr.code || (switchErr.error && switchErr.error.code));
              if (code === 4902) {
                return doAddThenSwitch()
                  .then(function () { return provider.request({ method: 'eth_chainId' }); })
                  .then(function () { setStateFromAccounts(account); })
                  .catch(function (addErr) {
                    warn('add/switch chain failed', { code: addErr && addErr.code, message: addErr && addErr.message });
                    emit(coreConfig.callbacks.onError, addErr);
                    throw addErr;
                  });
              }
              warn('wallet_switchEthereumChain error', { code: code, message: switchErr && switchErr.message });
              emit(coreConfig.callbacks.onError, switchErr);
              throw switchErr;
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
      try {
        removeProviderEvents();
      } catch (e) {
        if (DEBUG) log('disconnect: removeProviderEvents error', e);
      }
      state.connected = false;
      state.address = null;
      state.chainId = null;
      state.chainIdHex = null;
      state.networkName = null;
      state.environment = null;
      state.provider = null;
      state.nativeToken = null;
      state.tokenBalances = [];
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
      refreshNativeBalance: refreshNativeBalance,
      refreshTokenBalances: refreshTokenBalances,
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
      '.' + PREFIX + 'connecting{ font-style: italic; }' +
      '.' + PREFIX + 'button{ display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.25rem; cursor: pointer; font-size: 0.95rem; font-weight: 500; border: none; border-radius: 10px; transition: transform 0.1s ease, box-shadow 0.15s ease; }' +
      '.' + PREFIX + 'button:hover{ transform: translateY(-1px); }' +
      '.' + PREFIX + 'button:active{ transform: translateY(0); }' +
      '.' + PREFIX + 'button:disabled{ opacity: 0.6; cursor: not-allowed; transform: none; }' +
      '.' + PREFIX + 'connected{ display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 10px; max-width: 20em; min-height: 2.75rem; box-sizing: border-box; }' +
      '.' + PREFIX + 'connected-dot{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }' +
      '.' + PREFIX + 'address{ font-family: ui-monospace, monospace; font-size: 0.875em; padding: 0.2em 0; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 8em; }' +
      '.' + PREFIX + 'net{ font-size: 0.75rem; font-weight: 500; padding: 0.15em 0.45em; border-radius: 6px; flex-shrink: 0; }' +
      '.' + PREFIX + 'refresh{ font-size: 0.8rem; cursor: pointer; text-decoration: none; border-radius: 4px; padding: 0.2em 0.35em; flex-shrink: 0; transition: opacity 0.15s ease; }' +
      '.' + PREFIX + 'refresh:hover{ opacity: 0.85; }' +
      '.' + PREFIX + 'disconnect{ font-size: 0.8rem; cursor: pointer; text-decoration: none; border-radius: 4px; padding: 0.2em 0.35em; margin-left: auto; flex-shrink: 0; transition: opacity 0.15s ease; }' +
      '.' + PREFIX + 'disconnect:hover{ opacity: 0.85; }' +
      '.' + PREFIX + 'tokens{ margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.08); font-size: 0.8rem; }' +
      '.' + PREFIX + 'tokens[data-theme="dark"]{ border-top-color: rgba(255,255,255,0.12); }' +
      '.' + PREFIX + 'token-row{ display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.2em 0; }' +
      '.' + PREFIX + 'token-symbol{ font-weight: 600; }' +
      '.' + PREFIX + 'token-balance{ font-family: ui-monospace, monospace; }' +
      '/* theme: base */' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'message{ color: #374151; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'button{ background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%); color: #fff; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35); }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'button:hover{ box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45); }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'connected{ background: #f0f4ff; border: 1px solid #c7d2fe; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'connected-dot{ background: #22c55e; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'address{ color: #3730a3; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'net{ background: #e0e7ff; color: #4338ca; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'refresh{ color: #6b7280; }' +
      '.' + PREFIX + 'root[data-theme="base"] .' + PREFIX + 'refresh:hover{ color: #374151; }' +
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
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'refresh{ color: #6b7280; }' +
      '.' + PREFIX + 'root[data-theme="light"] .' + PREFIX + 'refresh:hover{ color: #111827; }' +
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
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'refresh{ color: #9ca3af; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'refresh:hover{ color: #f3f4f6; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'disconnect{ color: #9ca3af; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'disconnect:hover{ color: #f3f4f6; }' +
      '.' + PREFIX + 'root[data-theme="dark"] .' + PREFIX + 'message[style*="color:#c00"]{ color: #f87171 !important; }' +
      '/* dropdown */' +
      '.' + PREFIX + 'dropdown-wrap{ position: relative; display: inline-block; }' +
      '.' + PREFIX + 'trigger-wrap{ display: inline-block; }' +
      '.' + PREFIX + 'panel{ position: fixed; min-width: 280px; max-width: 360px; box-sizing: border-box; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.08); padding: 0; z-index: 9999; background: #fff; }' +
      '.' + PREFIX + 'panel[data-theme="dark"]{ background: #1f2937; border-color: rgba(255,255,255,0.1); box-shadow: 0 4px 24px rgba(0,0,0,0.4); }' +
      '.' + PREFIX + 'panel[data-theme="base"] .' + PREFIX + 'root{ background: #fff; }' +
      '.' + PREFIX + 'panel .' + PREFIX + 'root{ border-radius: 12px; padding: 0.75rem 1rem; }';
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

  function renderConnecting(container, uiConfig) {
    ensureStyles();
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    root.setAttribute('aria-label', 'Connecting wallet');
    setTheme(root, uiConfig.theme);
    root.innerHTML = '<p class="' + PREFIX + 'message ' + PREFIX + 'connecting">Connecting\u2026</p>';
    container.innerHTML = '';
    container.appendChild(root);
  }

  function renderReady(container, uiConfig, chainParams, onConnect) {
    ensureStyles();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = PREFIX + 'button';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', uiConfig.buttonLabel || 'Connect wallet');
    btn.setAttribute('tabindex', '0');
    btn.textContent = uiConfig.buttonLabel;
    function doConnect() {
      if (typeof onConnect === 'function') onConnect();
    }
    btn.addEventListener('click', function () { doConnect(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doConnect();
      }
    });
    container.innerHTML = '';
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Wallet connection');
    setTheme(root, uiConfig.theme);
    root.appendChild(btn);
    container.appendChild(root);
  }

  function formatTokenBalance(balance) {
    if (balance == null || isNaN(balance)) return '0';
    if (balance >= 1e9) return balance.toFixed(0);
    if (balance >= 1) return balance.toFixed(4);
    if (balance >= 1e-4) return balance.toFixed(6);
    return balance.toExponential(2);
  }

  function renderConnected(container, uiConfig, chainParams, stateSnapshot, onDisconnect, onRefresh) {
    ensureStyles();
    var addr = truncateAddress(stateSnapshot.address);
    var netShort = shortNetworkLabel(uiConfig.network, stateSnapshot.networkName);
    var titleSafe = escapeAttr(stateSnapshot.address || '');
    var netTitle = escapeAttr(stateSnapshot.networkName || stateSnapshot.chainIdHex || stateSnapshot.chainId || '');
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Wallet connected');
    setTheme(root, uiConfig.theme);
    var refreshLink = typeof onRefresh === 'function' ? '<a class="' + PREFIX + 'refresh" href="#" role="button" aria-label="Refresh balances" tabindex="0">Refresh</a>' : '';
    root.innerHTML =
      '<div class="' + PREFIX + 'connected">' +
      '<span class="' + PREFIX + 'connected-dot" aria-hidden="true"></span>' +
      '<span class="' + PREFIX + 'address" title="' + titleSafe + '">' + escapeAttr(addr) + '</span>' +
      '<span class="' + PREFIX + 'net" title="' + netTitle + '">' + escapeAttr(netShort) + '</span>' +
      refreshLink +
      '<a class="' + PREFIX + 'disconnect" href="#" role="button" aria-label="Disconnect" tabindex="0">Disconnect</a>' +
      '</div>';
    var native = stateSnapshot.nativeToken;
    var tokens = stateSnapshot.tokenBalances;
    var hasNative = native && (native.balance != null || native.symbol);
    if (hasNative || (tokens && tokens.length > 0)) {
      var tokensDiv = document.createElement('div');
      tokensDiv.className = PREFIX + 'tokens';
      if (uiConfig.theme === 'dark') tokensDiv.setAttribute('data-theme', 'dark');
      tokensDiv.setAttribute('aria-label', 'Saldos de tokens');
      if (hasNative) {
        var nativeSymbol = (native.symbol || native.name || '').trim() || 'Native';
        var nativeBalance = formatTokenBalance(native.balance);
        var nativeRow = document.createElement('div');
        nativeRow.className = PREFIX + 'token-row';
        nativeRow.innerHTML = '<span class="' + PREFIX + 'token-symbol" title="Token nativo">' + escapeAttr(nativeSymbol) + '</span><span class="' + PREFIX + 'token-balance" title="Balance">' + escapeAttr(nativeBalance) + '</span>';
        tokensDiv.appendChild(nativeRow);
      }
      if (tokens && tokens.length > 0) {
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          var symbolText = (t.symbol || t.name || 'Token').trim() || 'Token';
          var balanceText = formatTokenBalance(t.balance);
          var row = document.createElement('div');
          row.className = PREFIX + 'token-row';
          row.innerHTML = '<span class="' + PREFIX + 'token-symbol" title="Token">' + escapeAttr(symbolText) + '</span><span class="' + PREFIX + 'token-balance" title="Balance">' + escapeAttr(balanceText) + '</span>';
          tokensDiv.appendChild(row);
        }
      }
      root.appendChild(tokensDiv);
    }
    var disconnectLink = root.querySelector('.' + PREFIX + 'disconnect');
    function doDisconnect() {
      if (typeof onDisconnect === 'function') onDisconnect();
    }
    disconnectLink.addEventListener('click', function (e) {
      e.preventDefault();
      doDisconnect();
    });
    disconnectLink.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doDisconnect();
      }
    });
    if (typeof onRefresh === 'function') {
      var refreshLinkEl = root.querySelector('.' + PREFIX + 'refresh');
      if (refreshLinkEl) {
        refreshLinkEl.addEventListener('click', function (e) {
          e.preventDefault();
          onRefresh();
        });
        refreshLinkEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRefresh();
          }
        });
      }
    }
    container.innerHTML = '';
    container.appendChild(root);
  }

  // Panel content: Connecting, Ready (button), or Connected (bar). Used by Bridge for inline layout; later also for dropdown panel.
  function renderPanelContent(container, stateSnapshot, uiConfig, chainParams, onConnect, onDisconnect, onRefresh, isConnecting) {
    if (isConnecting) {
      renderConnecting(container, uiConfig);
      return;
    }
    if (stateSnapshot && stateSnapshot.connected) {
      renderConnected(container, uiConfig, chainParams, stateSnapshot, onDisconnect, onRefresh);
      return;
    }
    renderReady(container, uiConfig, chainParams, onConnect);
  }

  // Trigger view (button when disconnected, pill when connected). For inline layout not used separately; for dropdown (Fase 2) will be the clickable trigger.
  function renderTriggerInline(container, stateSnapshot, uiConfig, chainParams, isConnecting, onTriggerClick) {
    ensureStyles();
    var root = document.createElement('div');
    root.className = PREFIX + 'root ' + PREFIX + 'trigger';
    setTheme(root, uiConfig.theme);
    if (isConnecting || !stateSnapshot || !stateSnapshot.connected) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = PREFIX + 'button';
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', uiConfig.buttonLabel || 'Connect wallet');
      btn.textContent = isConnecting ? 'Connecting\u2026' : uiConfig.buttonLabel;
      btn.disabled = !!isConnecting;
      if (typeof onTriggerClick === 'function') {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          onTriggerClick();
        });
      }
      root.appendChild(btn);
    } else {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = PREFIX + 'connected';
      pill.setAttribute('role', 'button');
      pill.setAttribute('aria-label', 'Wallet connected: ' + truncateAddress(stateSnapshot.address));
      pill.textContent = truncateAddress(stateSnapshot.address) + ' \u2022 ' + shortNetworkLabel(uiConfig.network, stateSnapshot.networkName);
      if (typeof onTriggerClick === 'function') {
        pill.addEventListener('click', function (e) {
          e.stopPropagation();
          onTriggerClick();
        });
      }
      root.appendChild(pill);
    }
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
    var coreConfig = { network: config.network, callbacks: config.callbacks, tokenContracts: config.tokenContracts };
    var chainParamsRef = { current: null };
    var isConnectingRef = { current: false };
    var panelOpenRef = { current: false };

    function doRefreshBalances() {
      core.refreshNativeBalance();
      if (config.tokenContracts && config.tokenContracts.length > 0) {
        core.refreshTokenBalances(coreConfig);
      }
    }

    var triggerElRef = { current: null };
    var panelElRef = { current: null };

    function onDisconnectClick() {
      try {
        core.disconnect(coreConfig);
      } catch (err) {
        if (console && console.warn) console.warn('[DriveWallet] disconnect error', err);
      }
      if (config.layout === 'dropdown') closePanel();
    }

    function renderAll(stateSnapshot) {
      forEachContainer(config, function (el, uiConfig) {
        if (uiConfig.layout === 'dropdown') {
          el.innerHTML = '';
          var wrap = document.createElement('div');
          wrap.className = PREFIX + 'dropdown-wrap';
          wrap.style.position = 'relative';
          wrap.style.display = 'inline-block';
          el.appendChild(wrap);
          var triggerContainer = document.createElement('div');
          triggerContainer.className = PREFIX + 'trigger-wrap';
          wrap.appendChild(triggerContainer);
          triggerElRef.current = triggerContainer;
          renderTriggerInline(triggerContainer, stateSnapshot, uiConfig, chainParamsRef.current, isConnectingRef.current, togglePanel);
          if (panelOpenRef.current) {
            var triggerRect = triggerContainer.getBoundingClientRect();
            var panelContainer = document.createElement('div');
            panelContainer.className = PREFIX + 'panel';
            setTheme(panelContainer, uiConfig.theme);
            panelContainer.style.zIndex = '9999';
            panelContainer.style.position = 'fixed';
            panelContainer.style.left = triggerRect.left + 'px';
            panelContainer.style.top = (triggerRect.bottom + 4) + 'px';
            wrap.appendChild(panelContainer);
            panelElRef.current = panelContainer;
            renderPanelContent(panelContainer, stateSnapshot, uiConfig, chainParamsRef.current, connectWrapper, onDisconnectClick, doRefreshBalances, isConnectingRef.current);
            var panelRect = panelContainer.getBoundingClientRect();
            var winH = typeof window !== 'undefined' ? window.innerHeight : 600;
            if (panelRect.bottom > winH - 8 && triggerRect.top >= panelRect.height + 8) {
              panelContainer.style.top = (triggerRect.top - panelRect.height - 4) + 'px';
            }
          } else {
            panelElRef.current = null;
          }
        } else {
          triggerElRef.current = null;
          panelElRef.current = null;
          renderPanelContent(el, stateSnapshot, uiConfig, chainParamsRef.current, connectWrapper, onDisconnectClick, doRefreshBalances, isConnectingRef.current);
        }
      });
    }

    function connectWrapper() {
      if (isConnectingRef.current) return;
      var cp = chainParamsRef.current;
      if (!cp) return;
      isConnectingRef.current = true;
      renderAll(core.getState());
      core.connect(cp, coreConfig)
        .then(function () {
          isConnectingRef.current = false;
          renderAll(core.getState());
        })
        .catch(function () {
          isConnectingRef.current = false;
          renderAll(core.getState());
        });
    }

    function openPanel() {
      panelOpenRef.current = true;
      renderAll(core.getState());
    }
    function closePanel() {
      panelOpenRef.current = false;
      renderAll(core.getState());
    }
    function togglePanel() {
      panelOpenRef.current = !panelOpenRef.current;
      renderAll(core.getState());
    }

    try {
      window.DriveWalletWidget = window.DriveWalletWidget || {};
      window.DriveWalletWidget.refreshBalances = doRefreshBalances;
      window.DriveWalletWidget.openPanel = openPanel;
      window.DriveWalletWidget.closePanel = closePanel;
      window.DriveWalletWidget.togglePanel = togglePanel;
    } catch (e) {}

    if (config.layout === 'dropdown') {
      document.addEventListener('click', function dropdownClickOut(e) {
        if (!panelOpenRef.current) return;
        var t = e.target;
        if (triggerElRef.current && triggerElRef.current.contains(t)) return;
        if (panelElRef.current && panelElRef.current.contains(t)) return;
        closePanel();
      });
      document.addEventListener('keydown', function dropdownEscape(e) {
        if (e.key === 'Escape' && panelOpenRef.current) {
          e.preventDefault();
          closePanel();
        }
      });
    }

    core.init({
      onStateChange: function (stateSnapshot) {
        if (stateSnapshot.connected && !chainParamsRef.current) return;
        renderAll(stateSnapshot);
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
        isConnectingRef.current = false;
        if (config.callbacks.onReady) config.callbacks.onReady();
        if (!provider) {
          forEachContainer(config, function (el, uiConfig) { renderNoWallet(el, uiConfig); });
          return;
        }
        renderAll(stateSnapshot);
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
            chainParamsRef.current = chainParams;
            renderAll(core.getState());
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
