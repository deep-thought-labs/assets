/**
 * Loads network-data.json and renders the page from it. All sections are key-value
 * driven by the JSON; no hardcoded labels beyond the JSON keys.
 */
(function () {
  var NETWORK_SCALAR_KEYS = [
    'environment', 'name', 'chain_id', 'chain_name', 'bech32_prefix',
    'evm_chain_id', 'evm_chain_id_hex', 'evm_chain_name', 'evm_network_id',
    'info_url', 'icon'
  ];

  var ENDPOINT_ORDER = ['p2p', 'comet-rpc', 'grpc', 'grpc-web', 'rest', 'json-rpc-http', 'json-rpc-ws'];

  /** UI copy for mainnet vs testnet vs creative (title, heading, intro). Not in JSON — presentation only. */
  var NETWORK_UI = {
    mainnet: {
      title: 'Mainnet — Project 42',
      heading: 'Mainnet',
      intro: 'This page provides the reference data needed to operate and interact with the <strong>main chain</strong>: identifiers, endpoints, genesis, and native token. Mainnet is the primary production network.'
    },
    testnet: {
      title: 'Testnet — Project 42',
      heading: 'Testnet',
      intro: 'This page provides reference data for the <strong>test network</strong>. Testnet mirrors Mainnet in configuration and is intended for testing: new chain features, upgrades, or products and services should be tried here first. Once validated and stable, they can be replicated or deployed on Mainnet.'
    },
    creative: {
      title: 'Creative — Project 42',
      heading: 'Creative',
      intro: 'Creative is a <strong>temporary testnet</strong> for short-lived or disposable networks: time-bound objectives, experiments, or a <strong>Phoenix</strong> strategy where the chain is torn down and recreated on a schedule (e.g. weekly or monthly). Use this page for the current Creative instance; endpoints and genesis may change each time the network is recreated.'
    }
  };

  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatValue(key, value) {
    if (value == null || value === '') return '—';
    if (key === 'info_url') return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener">' + escapeHtml(value) + '</a>';
    return '<code>' + escapeHtml(String(value)) + '</code>';
  }

  function renderNetworkScalars(tbody, data) {
    if (!tbody || !data) return;
    var rows = [];
    NETWORK_SCALAR_KEYS.forEach(function (key) {
      if (!(key in data)) return;
      rows.push('<tr><td>' + escapeHtml(key) + '</td><td>' + formatValue(key, data[key]) + '</td></tr>');
    });
    tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="2" class="muted">No network fields.</td></tr>';
  }

  function renderNativeCurrency(tbody, denomUnitsEl, data) {
    if (!tbody || !data || !data.native_currency) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="muted">No native currency.</td></tr>';
      return;
    }
    var nc = data.native_currency;
    var keys = ['name', 'symbol', 'base', 'display', 'description'];
    var rows = keys.map(function (key) {
      var val = nc[key];
      var cell = (key === 'description' && val) ? escapeHtml(val) : formatValue(key, val);
      return '<tr><td>' + escapeHtml(key) + '</td><td>' + cell + '</td></tr>';
    });
    tbody.innerHTML = rows.join('');

    if (denomUnitsEl && nc.denom_units && nc.denom_units.length > 0) {
      var th = ['denom', 'exponent', 'aliases'];
      var unitRows = nc.denom_units.map(function (u) {
        var aliases = Array.isArray(u.aliases) ? u.aliases.join(', ') : '';
        return '<tr><td><code>' + escapeHtml(u.denom) + '</code></td><td>' + escapeHtml(String(u.exponent)) + '</td><td>' + escapeHtml(aliases) + '</td></tr>';
      });
      denomUnitsEl.innerHTML = '<table class="chain-table" style="margin-top:0.5rem"><thead><tr>' +
        th.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + unitRows.join('') + '</tbody></table>';
      denomUnitsEl.style.display = '';
    }
  }

  function isAbsoluteUrl(pathOrUrl) {
    return typeof pathOrUrl === 'string' && (pathOrUrl.indexOf('http://') === 0 || pathOrUrl.indexOf('https://') === 0);
  }

  function resourceHref(pathOrUrl, base) {
    if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;
    var isHttp = base && (base.indexOf('http://') === 0 || base.indexOf('https://') === 0);
    return isHttp ? base + pathOrUrl : pathOrUrl;
  }

  function resourceCurlUrl(pathOrUrl, base) {
    if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;
    var isHttp = base && (base.indexOf('http://') === 0 || base.indexOf('https://') === 0);
    return isHttp ? base + pathOrUrl : pathOrUrl;
  }

  function renderResources(tbody, data) {
    if (!tbody) return;
    if (!data || !data.resources) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">No resources.</td></tr>';
      return;
    }
    var res = data.resources;
    var base = window.location.origin;
    var rows = [];

    var titles = { genesis: 'Download genesis (terminal)', network_data: 'Download network-data.json (terminal)' };

    for (var key in res) {
      if (!Object.prototype.hasOwnProperty.call(res, key)) continue;
      var r = res[key];
      var pathOrUrl = r.src || r.path || r.url;
      if (!pathOrUrl) continue;
      var showDownload = r.download === true;
      var showOpenInBrowser = r.open_in_browser === true;
      var href = resourceHref(pathOrUrl, base);
      var curlUrl = resourceCurlUrl(pathOrUrl, base);
      var filename = r.curl_output_filename || (key + '.json');
      var title = titles[key] || 'Download ' + key + ' (terminal)';
      var valueCell = showOpenInBrowser
        ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' + escapeHtml(href) + '</a>'
        : '<code class="endpoint-url">' + escapeHtml(href) + '</code>';
      var downloadBtn = showDownload
        ? '<button type="button" class="chain-table-action-btn" data-copy-command-open data-copy-command-title="' + escapeHtml(title) + '" data-copy-command-description="Download the file to the current directory with curl." data-copy-command-curl-url="' + escapeHtml(curlUrl) + '" data-copy-command-curl-output="' + escapeHtml(filename) + '" aria-label="Download">Download</button>'
        : '';
      var openBtn = showOpenInBrowser
        ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener" class="chain-table-action-btn">Open</a>'
        : '';
      var actions = (downloadBtn + openBtn).trim();
      rows.push('<tr><td>' + escapeHtml(key) + '</td><td>' + valueCell + '</td><td class="actions-cell">' + actions + '</td></tr>');
    }

    tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="3" class="muted">No resources.</td></tr>';
  }

  /** Endpoint types that get an "Open" link (HTTP-style; openable in browser). */
  var ENDPOINT_OPEN_IN_BROWSER = ['comet-rpc', 'json-rpc-http', 'rest', 'grpc-web'];

  function canOpenInBrowser(key) {
    return ENDPOINT_OPEN_IN_BROWSER.indexOf(key) !== -1;
  }

  function renderEndpoints(tbody, data) {
    if (!tbody) return;
    if (!data || !data.endpoints) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">No endpoints.</td></tr>';
      return;
    }
    var html = [];
    ENDPOINT_ORDER.forEach(function (key) {
      var list = data.endpoints[key];
      if (!Array.isArray(list) || list.length === 0) return;
      html.push('<tr class="endpoint-group-header"><td colspan="3">' + escapeHtml(key) + '</td></tr>');
      list.forEach(function (item) {
        var url = item && item.url;
        if (!url) return;
        var urlCell = '<code class="endpoint-url">' + escapeHtml(url) + '</code>';
        var copyBtn = '<button type="button" class="chain-table-action-btn copy-url-btn" data-copy-url="' + escapeHtml(url) + '" aria-label="Copy URL">Copy</button>';
        var openBtn = canOpenInBrowser(key)
          ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="chain-table-action-btn">Open</a>'
          : '';
        html.push('<tr><td><code>' + escapeHtml(key) + '</code></td><td>' + urlCell + '</td><td class="actions-cell">' + copyBtn + openBtn + '</td></tr>');
      });
    });
    tbody.innerHTML = html.length ? html.join('') : '<tr><td colspan="3" class="muted">No endpoints configured.</td></tr>';
  }

  function renderFaucets(section, tbody, data) {
    if (!section || !tbody) return;
    var list = data && data.faucets;
    if (!Array.isArray(list) || list.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    var rows = list.map(function (url) {
      return '<tr><td>faucet</td><td><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a></td></tr>';
    });
    tbody.innerHTML = rows.join('');
  }

  function renderFeatures(section, tbody, data) {
    if (!section || !tbody) return;
    var list = data && data.features;
    if (!Array.isArray(list) || list.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    var rows = list.map(function (f) {
      var name = f && f.name != null ? f.name : '—';
      return '<tr><td>' + escapeHtml(String(name)) + '</td></tr>';
    });
    tbody.innerHTML = rows.join('');
  }

  function renderExplorers(section, tbody, data) {
    if (!section || !tbody) return;
    var list = data && data.explorers;
    if (!Array.isArray(list) || list.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    var rows = list.map(function (e) {
      var name = e && e.name != null ? e.name : '—';
      var explorerUrl = e && e.url ? e.url : '';
      var urlCell = explorerUrl
        ? '<a href="' + escapeHtml(explorerUrl) + '" target="_blank" rel="noopener">' + escapeHtml(explorerUrl) + '</a>'
        : '—';
      var openBtn = explorerUrl
        ? '<a href="' + escapeHtml(explorerUrl) + '" target="_blank" rel="noopener" class="chain-table-action-btn">Open</a>'
        : '';
      return '<tr><td>' + escapeHtml(name) + '</td><td>' + urlCell + '</td><td class="actions-cell">' + openBtn + '</td></tr>';
    });
    tbody.innerHTML = rows.join('');
  }

  function showLoadError(msg) {
    console.error('network-page.js:', msg);
    var banner = document.createElement('p');
    banner.className = 'error-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'background:#f8d7da;color:#721c24;padding:0.75rem 1rem;border-radius:4px;margin:0 0 1rem;white-space:pre-line;';
    banner.textContent = msg;
    var first = document.body && document.body.querySelector && document.body.querySelector('p.back');
    if (first && first.parentNode) first.parentNode.insertBefore(banner, first.nextSibling);
    var tbody = el('network-scalars-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="muted" style="white-space:pre-line">' + escapeHtml(msg) + '</td></tr>';
  }

  function run() {
    var pathname = (window.location && window.location.pathname) || '';
    var networkParam = document.body && document.body.getAttribute('data-network');
    var network = (networkParam === 'mainnet' || networkParam === 'testnet' || networkParam === 'creative') ? networkParam : (pathname.indexOf('creative') !== -1 ? 'creative' : pathname.indexOf('testnet') !== -1 ? 'testnet' : 'mainnet');
    var ui = NETWORK_UI[network] || NETWORK_UI.mainnet;

    document.title = ui.title;
    if (el('network-heading')) el('network-heading').textContent = ui.heading;
    if (el('network-intro')) el('network-intro').innerHTML = ui.intro;

    var lastSlash = pathname.lastIndexOf('/');
    var dir;
    if (lastSlash === -1) {
      dir = './';
    } else {
      var afterSlash = pathname.slice(lastSlash + 1);
      if (afterSlash && afterSlash.indexOf('.') !== -1) {
        dir = pathname.substring(0, lastSlash + 1);
      } else {
        dir = pathname.endsWith('/') ? pathname : pathname + '/';
      }
    }
    var jsonUrl = dir + 'network-data.json';
    fetch(jsonUrl)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText || 'HTTP ' + res.status)); })
      .then(function (data) {
        if (el('network-subtitle')) el('network-subtitle').textContent = 'Project 42 · ' + (data.name || '');
        renderNetworkScalars(el('network-scalars-tbody'), data);
        renderNativeCurrency(el('native-currency-tbody'), el('native-currency-denom-units'), data);
        renderResources(el('resources-tbody'), data);
        renderEndpoints(el('endpoints-tbody'), data);
        renderFaucets(el('faucets-section'), el('faucets-tbody'), data);
        renderFeatures(el('features-section'), el('features-tbody'), data);
        renderExplorers(el('explorers-section'), el('explorers-tbody'), data);
      })
      .catch(function (err) {
        showLoadError('Failed to load network-data.json: ' + (err && err.message ? err.message : String(err)));
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.copy-url-btn');
    if (!btn) return;
    var url = btn.getAttribute('data-copy-url');
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        var label = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = label; }, 1500);
      });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
