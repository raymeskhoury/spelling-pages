const FILES = {};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'LOAD_ARCHIVE' || !data.buffer) return;

  const files = parseArchive(new Uint8Array(data.buffer));
  for (const key of Object.keys(FILES)) {
    delete FILES[key];
  }
  Object.assign(FILES, files);
  const index = FILES['index.html'];
  const indexHtml = index ? new TextDecoder().decode(index) : '';
  event.ports[0]?.postMessage({ type: 'READY', indexHtml });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope).pathname.replace(/\/$/, '');
  let path = url.pathname;
  if (scope && path.startsWith(scope)) {
    path = path.slice(scope.length);
  }
  path = decodeURIComponent(path.replace(/^\/+/, ''));
  if (path === '' || path.endsWith('/')) {
    path = `${path}index.html`.replace(/^\/+/, '');
  }

  const bytes = FILES[path];
  if (!bytes) return;

  event.respondWith(
    new Response(bytes, {
      headers: {
        'Content-Type': mimeType(path),
        'Cache-Control': 'no-store',
      },
    }),
  );
});

function parseArchive(bytes) {
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== 'SPB1') {
    throw new Error('Encrypted app payload is not a spelling archive.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let offset = 4;
  while (offset + 8 <= bytes.length) {
    const pathLen = view.getUint32(offset, true);
    offset += 4;
    const dataLen = view.getUint32(offset, true);
    offset += 4;
    if (offset + pathLen + dataLen > bytes.length) {
      throw new Error('Encrypted app payload is truncated.');
    }
    const path = new TextDecoder().decode(bytes.subarray(offset, offset + pathLen));
    offset += pathLen;
    files[path] = bytes.slice(offset, offset + dataLen);
    offset += dataLen;
  }
  return files;
}

function mimeType(path) {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.wasm')) return 'application/wasm';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.ttf')) return 'font/ttf';
  if (path.endsWith('.otf')) return 'font/otf';
  return 'application/octet-stream';
}
