/**
 * render-markdown.js — Reusable Markdown viewer for the assets site.
 *
 * Fetches a Markdown file, renders it to HTML (via marked), injects into a container,
 * adds heading IDs for anchor links, optionally applies a CSS class to tables, and
 * adds a "Copy" button to each code block so users can copy the contents.
 *
 * Dependency: uses "marked" for parsing. If marked is not already on the page,
 * this script loads it from CDN (jsDelivr) automatically. You only need to include
 * this one script.
 *
 * Usage (two ways):
 *
 * 1) Data attributes (auto-init on DOMContentLoaded):
 *    Add to the content container:
 *      data-markdown-src="path/to/file.md"     — URL of the Markdown file (required)
 *      data-markdown-loading-id="id"          — ID of element to hide when done (optional)
 *      data-markdown-error-id="id"            — ID of element to show on error (optional)
 *      data-markdown-table-class="chain-table"— Class to add to <table> (default: chain-table)
 *    The element with data-markdown-src is the container where HTML will be injected.
 *    Loading/error elements are optional; if present they are shown/hidden automatically.
 *
 * 2) Programmatic:
 *    AssetsMarkdown.render({
 *      sourceUrl: 'path/to/file.md',
 *      contentId: 'spec-content',   // or contentEl: document.getElementById('...')
 *      loadingId: 'spec-loading',   // optional
 *      errorId: 'spec-error',       // optional
 *      tableClass: 'chain-table',   // optional, default 'chain-table'
 *      loadingMessage: 'Loading…', // optional
 *      errorMessage: function(err) { return 'Error: ' + err.message; } // optional
 *    });
 *
 * Returns a Promise that resolves when render is done, or rejects on fetch/parse error.
 *
 * Flow: on load, script scans for elements with data-markdown-src; for each, fetches
 * the .md URL, parses with marked, injects HTML, adds heading IDs and code-block
 * Copy buttons, then toggles loading/error elements. Load "marked" from CDN if missing.
 */
(function (global) {
  'use strict';

  function getEl(idOrEl) {
    if (typeof idOrEl === 'string') return document.getElementById(idOrEl) || null;
    if (idOrEl && idOrEl.nodeType === 1) return idOrEl;
    return null;
  }

  function slug(text) {
    return String(text).trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'heading';
  }

  function ensureHeadingIds(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('h1, h2, h3').forEach(function (h) {
      if (h.id) return;
      var match = h.textContent.match(/^(\d+(?:\.\d+)?)\.\s*(.+)$/);
      var id = match
        ? match[1].replace(/\./g, '-') + '-' + slug(match[2])
        : slug(h.textContent);
      if (id) h.id = id;
    });
  }

  function applyTableClass(root, tableClass) {
    if (!root || !tableClass) return;
    root.querySelectorAll('table').forEach(function (t) {
      t.classList.add(tableClass);
    });
  }

  var MARKDOWN_CODE_BLOCK_CLASS = 'markdown-code-block';

  function addCopyButtonsToCodeBlocks(root) {
    if (!root || !root.querySelectorAll) return;
    var pres = root.querySelectorAll('pre');
    pres.forEach(function (pre) {
      var codeEl = pre.querySelector('code');
      var text = (codeEl ? codeEl.textContent : pre.textContent) || '';
      if (!text.trim()) return;
      var wrapper = document.createElement('div');
      wrapper.className = MARKDOWN_CODE_BLOCK_CLASS;
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      var actions = document.createElement('div');
      actions.className = 'actions';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.addEventListener('click', function () {
        var label = btn.textContent;
        function setCopyResult(success) {
          btn.textContent = success ? 'Copied' : 'Copy';
          setTimeout(function () { btn.textContent = label; }, 1500);
        }
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(function () { setCopyResult(true); }, function () { setCopyResult(false); });
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            setCopyResult(document.execCommand('copy'));
            document.body.removeChild(ta);
          } catch (e) {
            setCopyResult(false);
          }
        }
      });
      actions.appendChild(btn);
      wrapper.appendChild(actions);
    });
  }

  function highlightCodeBlocks(root) {
    if (!root || !global.hljs) return;
    root.querySelectorAll('pre code').forEach(function (el) {
      try {
        el.removeAttribute('data-highlighted');
        global.hljs.highlightElement(el);
      } catch (e) { /* ignore */ }
    });
  }

  function render(options) {
    var opts = options || {};
    var sourceUrl = opts.sourceUrl;
    var contentEl = getEl(opts.contentEl || opts.contentId);
    var loadingEl = getEl(opts.loadingId || opts.loadingEl);
    var errorEl = getEl(opts.errorId || opts.errorEl);
    var tableClass = opts.tableClass !== undefined ? opts.tableClass : 'chain-table';
    var loadingMessage = opts.loadingMessage !== undefined ? opts.loadingMessage : 'Loading…';
    var getErrorMessage = typeof opts.errorMessage === 'function'
      ? opts.errorMessage
      : function (err) {
          return 'Could not load document: ' + (err && err.message ? err.message : String(err)) +
            '. Serve this page over HTTP (e.g. from the same origin as the .md file).';
        };

    if (!sourceUrl || !contentEl) {
      var missing = !sourceUrl ? 'sourceUrl' : 'contentId/contentEl';
      return Promise.reject(new Error('AssetsMarkdown.render: missing ' + missing));
    }

    if (loadingEl) {
      loadingEl.textContent = loadingMessage;
      loadingEl.style.display = '';
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    contentEl.style.display = 'none';

    return fetch(sourceUrl)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.text();
      })
      .then(function (md) {
        if (typeof global.marked === 'undefined') {
          contentEl.innerHTML = '';
          contentEl.textContent = 'Markdown renderer not available. Load "marked" before this script.';
        } else {
          global.marked.setOptions({ gfm: true });
          contentEl.innerHTML = global.marked.parse(md);
          ensureHeadingIds(contentEl);
          applyTableClass(contentEl, tableClass);
          addCopyButtonsToCodeBlocks(contentEl);
          highlightCodeBlocks(contentEl);
        }
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        contentEl.style.display = 'block';
        return contentEl;
      })
      .catch(function (err) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
          errorEl.textContent = getErrorMessage(err);
          errorEl.style.display = 'block';
        }
        throw err;
      });
  }

  function autoInit() {
    var containers = document.querySelectorAll('[data-markdown-src]');
    containers.forEach(function (el) {
      var src = el.getAttribute('data-markdown-src');
      if (!src) return;
      var loadingId = el.getAttribute('data-markdown-loading-id') || '';
      var errorId = el.getAttribute('data-markdown-error-id') || '';
      var tableClass = el.getAttribute('data-markdown-table-class') || 'chain-table';
      render({
        sourceUrl: src,
        contentEl: el,
        loadingId: loadingId || undefined,
        errorId: errorId || undefined,
        tableClass: tableClass
      });
    });
  }

  var MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

  function whenReady(fn) {
    if (!global.document) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function runAutoInit() {
    whenReady(autoInit);
  }

  if (global.document && typeof global.marked === 'undefined') {
    var s = document.createElement('script');
    s.src = MARKED_CDN;
    s.onload = runAutoInit;
    (document.head || document.documentElement).appendChild(s);
  } else {
    runAutoInit();
  }

  global.AssetsMarkdown = { render: render, autoInit: autoInit };
})(typeof window !== 'undefined' ? window : this);
