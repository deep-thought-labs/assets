#!/usr/bin/env node
/**
 * Local static server that always returns 200 for HTML documents (no 304).
 * Fixes Safari blank page when navigating. Usage: node server.js
 * Serves ./public on http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function pathToFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  if (decoded === '/' || decoded === '') return path.join(ROOT, 'index.html');
  let file = path.join(ROOT, path.normalize(decoded).replace(/^(\.\.(\/|\\))+/, ''));
  if (file.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.endsWith('.html') && !path.extname(file)) {
    const withHtml = file + '.html';
    if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) return withHtml;
    const indexInDir = path.join(file, 'index.html');
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
  const file = pathToFile(req.url.split('?')[0]);
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
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
