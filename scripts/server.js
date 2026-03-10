#!/usr/bin/env node
/**
 * Local static server for the public/ directory.
 *
 * - Serves files from public/ at http://localhost:3000.
 * - HTML responses use Cache-Control: no-store and status 200 (no 304) to avoid
 *   Safari blank page on navigation.
 * - Sends Access-Control-Allow-Origin: * for all responses (for local cross-origin use).
 * - URL without extension or with trailing slash resolves to index.html in that directory.
 *
 * Run from repo root: node scripts/server.js  (or npm start)
 */
const path = require('path');
const ROOT = path.join(__dirname, '..', 'public');

const http = require('http');
const fs = require('fs');

const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

/**
 * Resolve request URL to a file path under ROOT (public/).
 * "/" → index.html; "/path/" or "/path" with no extension → path/index.html or path.html if present.
 */
function pathToFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  if (decoded === '/' || decoded === '') return path.join(ROOT, 'index.html');
  const relativePath = decoded.replace(/^\//, '').replace(/^(\.\.(\/|\\))+/, '') || '';
  let file = path.join(ROOT, path.normalize(relativePath));
  if (file.endsWith(path.sep) || (!path.extname(file) && !file.endsWith('.html'))) {
    if (file.endsWith(path.sep)) file = file.slice(0, -1);
    const indexInDir = path.join(file, 'index.html');
    const withHtml = file + '.html';
    if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) return withHtml;
    if (fs.existsSync(indexInDir)) return indexInDir;
  }
  return file;
}

function isHtmlResponse(filePath) {
  return path.extname(filePath) === '.html';
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }
  const urlPath = req.url.split('?')[0];
  const file = pathToFile(urlPath);
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end();
      return;
    }
    // If request had no trailing slash but we resolved to index.html, redirect to canonical URL with /
    const isDirIndex = path.basename(file) === 'index.html' && !urlPath.endsWith('/') && !urlPath.match(/\.[a-z0-9]+$/i);
    if (isDirIndex) {
      res.statusCode = 302;
      res.setHeader('Location', urlPath + '/');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end();
      return;
    }
    const ext = path.extname(file);
    const mime = MIME[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (isHtmlResponse(file)) {
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      const stream = fs.createReadStream(file);
      stream.pipe(res);
      return;
    }
    res.statusCode = 200;
    const stream = fs.createReadStream(file);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}/ (HTML always 200, no 304)`);
});
