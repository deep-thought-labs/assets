/**
 * Wallet Connect Widget — Infinite Drive
 * Embeddable widget to connect EIP-1193 wallets to Infinite Drive (mainnet/testnet/creative).
 * Usage: <div data-drive-widget="wallet-connect" data-network="mainnet"></div>
 *        <script src=".../wallet-connect.js"></script>
 */
(function () {
  'use strict';

  var PREFIX = 'drive-wc-';
  var NETWORKS = ['mainnet', 'testnet', 'creative'];
  var scriptEl = document.currentScript;

  function getScript() {
    return scriptEl;
  }

  function getBaseUrl() {
    var script = getScript();
    if (!script || !script.src) return '';
    try {
      var url = new URL(script.src);
      return url.origin;
    } catch (e) {
      return '';
    }
  }

  function getConfig() {
    var globalConfig = window.DriveWalletWidget || {};
    var script = getScript();
    var network = (globalConfig.network || (script && script.getAttribute('data-network')) || 'mainnet').toLowerCase();
    if (NETWORKS.indexOf(network) === -1) network = 'mainnet';

    var targetId = globalConfig.targetId || (script && script.getAttribute('data-target-id')) || '';
    var container = findContainer(script, targetId, network);

    return {
      network: network,
      targetId: targetId,
      container: container,
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

  function findContainer(script, targetId, network) {
    var el = document.querySelector('[data-drive-widget="wallet-connect"]');
    if (el) return el;
    if (targetId) {
      el = document.getElementById(targetId);
      if (el) return el;
    }
    el = document.querySelector('[data-network="' + network + '"]');
    if (el) return el;
    el = document.querySelector('[data-network]');
    return el || null;
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
    return {
      chainId: data.evm_chain_id_hex || ('0x' + (data.evm_chain_id || 0).toString(16)),
      chainName: data.evm_chain_name || data.name || 'Infinite Drive',
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
    var ethereum = window.ethereum;
    if (!ethereum) return null;
    if (Array.isArray(ethereum)) return ethereum[0] || null;
    return ethereum;
  }

  function chainIdToHex(chainId) {
    if (chainId == null) return null;
    if (typeof chainId === 'string' && chainId.startsWith('0x')) return chainId;
    var n = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    return isNaN(n) ? null : '0x' + n.toString(16);
  }

  function truncateAddress(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '\u2026' + addr.slice(-4);
  }

  var state = {
    connected: false,
    address: null,
    chainId: null,
    networkName: null,
    provider: null
  };

  function syncDriveWallet() {
    window.DriveWallet = {
      connected: state.connected,
      address: state.address,
      chainId: state.chainId,
      networkName: state.networkName,
      provider: state.provider
    };
  }

  function emit(cb, arg) {
    if (cb) try { cb(arg); } catch (e) { console.error('[DriveWallet] callback error', e); }
  }

  var stylesInjected = false;
  function ensureStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var style = document.createElement('style');
    style.textContent =
      '.' + PREFIX + 'root{ font-family: system-ui, sans-serif; font-size: 14px; }' +
      '.' + PREFIX + 'message{ padding: 0.5rem 0; color: #666; }' +
      '.' + PREFIX + 'button{ padding: 0.5rem 1rem; cursor: pointer; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; }' +
      '.' + PREFIX + 'button:hover{ background: #444; }' +
      '.' + PREFIX + 'button:disabled{ opacity: 0.6; cursor: not-allowed; }' +
      '.' + PREFIX + 'connected{ margin: 0.5rem 0; }' +
      '.' + PREFIX + 'address{ font-family: monospace; font-size: 0.9em; }' +
      '.' + PREFIX + 'disconnect{ margin-left: 0.5rem; font-size: 0.85em; color: #888; cursor: pointer; text-decoration: underline; }';
    (document.head || document.documentElement).appendChild(style);
  }

  function renderLoading(container, config) {
    ensureStyles();
    container.innerHTML = '<div class="' + PREFIX + 'root"><p class="' + PREFIX + 'message">Loading network\u2026</p></div>';
  }

  function renderNoWallet(container, config) {
    ensureStyles();
    container.innerHTML =
      '<div class="' + PREFIX + 'root">' +
      '<p class="' + PREFIX + 'message">Install MetaMask or an EVM-compatible wallet to connect.</p>' +
      '</div>';
  }

  function renderError(container, config, message) {
    ensureStyles();
    container.innerHTML =
      '<div class="' + PREFIX + 'root">' +
      '<p class="' + PREFIX + 'message" style="color:#c00">' + (message || 'Something went wrong.') + '</p>' +
      '</div>';
  }

  function renderReady(container, config, chainParams) {
    ensureStyles();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = PREFIX + 'button';
    btn.textContent = config.buttonLabel;
    btn.addEventListener('click', function () { doConnect(container, config, chainParams); });
    container.innerHTML = '';
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    root.appendChild(btn);
    container.appendChild(root);
  }

  function renderConnected(container, config, chainParams) {
    ensureStyles();
    var addr = truncateAddress(state.address);
    var net = state.networkName || state.chainId || 'Unknown';
    var root = document.createElement('div');
    root.className = PREFIX + 'root';
    root.innerHTML =
      '<div class="' + PREFIX + 'connected">' +
      '<span class="' + PREFIX + 'address" title="' + (state.address || '') + '">' + addr + '</span>' +
      ' <span>(' + net + ')</span>' +
      '<a class="' + PREFIX + 'disconnect" href="#" role="button">Disconnect</a>' +
      '</div>';
    var disconnectLink = root.querySelector('.' + PREFIX + 'disconnect');
    disconnectLink.addEventListener('click', function (e) {
      e.preventDefault();
      doDisconnect(container, config, chainParams);
    });
    container.innerHTML = '';
    container.appendChild(root);
  }

  function doConnect(container, config, chainParams) {
    var provider = getProvider();
    if (!provider) {
      renderNoWallet(container, config);
      emit(config.callbacks.onError, new Error('No wallet'));
      return;
    }
    var chainIdHex = chainParams.chainId;
    var addChainThenConnect = function () {
      provider.request({ method: 'eth_requestAccounts' })
        .then(function (accounts) {
          if (!accounts || !accounts.length) {
            emit(config.callbacks.onError, new Error('No accounts'));
            return;
          }
          state.connected = true;
          state.address = accounts[0];
          state.chainId = chainIdHex;
          state.networkName = chainParams.chainName;
          state.provider = provider;
          syncDriveWallet();
          renderConnected(container, config, chainParams);
          emit(config.callbacks.onConnect, { address: state.address, chainId: state.chainId, networkName: state.networkName });

          provider.on('accountsChanged', function (accounts) {
            if (!accounts || !accounts.length) {
              state.connected = false;
              state.address = null;
              syncDriveWallet();
              renderReady(container, config, chainParams);
              emit(config.callbacks.onDisconnect);
            } else {
              state.address = accounts[0];
              syncDriveWallet();
              renderConnected(container, config, chainParams);
            }
            emit(config.callbacks.onAccountsChanged, accounts || []);
          });

          provider.on('chainChanged', function (id) {
            state.chainId = chainIdToHex(id);
            state.networkName = chainParams.chainName;
            syncDriveWallet();
            renderConnected(container, config, chainParams);
            emit(config.callbacks.onChainChanged, state.chainId);
          });
        })
        .catch(function (err) {
          renderReady(container, config, chainParams);
          emit(config.callbacks.onError, err);
        });
    };

    provider.request({ method: 'eth_chainId' })
      .then(function (currentId) {
        var currentHex = chainIdToHex(currentId);
        if (currentHex === chainIdHex) {
          addChainThenConnect();
          return;
        }
        provider.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: chainIdHex, chainName: chainParams.chainName, nativeCurrency: chainParams.nativeCurrency, rpcUrls: chainParams.rpcUrls, blockExplorerUrls: chainParams.blockExplorerUrls }]
        }).then(function () { addChainThenConnect(); }).catch(function (err) {
          renderReady(container, config, chainParams);
          emit(config.callbacks.onError, err);
        });
      })
      .catch(function (err) {
        renderReady(container, config, chainParams);
        emit(config.callbacks.onError, err);
      });
  }

  function doDisconnect(container, config, chainParams) {
    state.connected = false;
    state.address = null;
    state.chainId = null;
    state.networkName = null;
    state.provider = null;
    syncDriveWallet();
    renderReady(container, config, chainParams);
    emit(config.callbacks.onDisconnect);
  }

  function run() {
    var config = getConfig();
    if (!config.container) return;

    syncDriveWallet();

    var base = getBaseUrl();
    if (!base) {
      renderError(config.container, config, 'Could not resolve script base URL.');
      emit(config.callbacks.onError, new Error('Base URL'));
      return;
    }

    var networkPath = base + '/' + config.network + '/network-data.json';

    renderLoading(config.container, config);

    fetch(networkPath)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      })
      .then(function (data) {
        var chainParams = buildAddChainParams(data);
        if (!chainParams) {
          renderError(config.container, config, 'Invalid network data.');
          emit(config.callbacks.onError, new Error('Invalid network data'));
          return;
        }
        emit(config.callbacks.onReady);

        var provider = getProvider();
        if (!provider) {
          renderNoWallet(config.container, config);
          return;
        }
        renderReady(config.container, config, chainParams);
      })
      .catch(function (err) {
        renderError(config.container, config, 'Failed to load network: ' + (err.message || String(err)));
        emit(config.callbacks.onError, err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
