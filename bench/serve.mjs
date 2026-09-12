// bench/serve.mjs
// リポジトリルートを静的配信する。ffmpeg-mt 比較に SharedArrayBuffer が要るため
// 全レスポンスに COOP: same-origin と COEP: require-corp を付ける。
// 使い方: node bench/serve.mjs [port]
// 仕様どおりポートは 8765 が既定。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.argv[2]) || 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, headers, body) {
  // COOP/COEP は全レスポンスに付ける（仕様）。
  headers['Cross-Origin-Opener-Policy'] = 'same-origin';
  headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
  res.writeHead(status, headers);
  if (body) {
    res.end(body);
  } else {
    res.end();
  }
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    // ルート直下のつもりが bench/ へ来たら index を返す。
    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(root)) {
      send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'forbidden');
      return;
    }
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
      };
      if (req.method === 'HEAD') {
        send(res, 200, headers, null);
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'read error');
      });
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      res.writeHead(200, headers);
      stream.pipe(res);
    });
  } catch (error) {
    send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'server error');
  }
});

server.listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}/bench/`);
});
