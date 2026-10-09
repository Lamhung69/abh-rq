// Bộ nhớ đệm để Sổ văn bản chạy không cần mạng. Dữ liệu vụ án, văn bản KHÔNG đi qua đây (nằm trong IndexedDB của máy).
const VER = 'svb-v1.0.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
const OCR = ['./ocr/tesseract.min.js', './ocr/worker.min.js', './ocr/core/tesseract-core-simd-lstm.wasm.js',
  './ocr/core/tesseract-core-lstm.wasm.js', './ocr/lang/vie.traineddata.gz'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await c.addAll(SHELL);
    try { await c.addAll(OCR); } catch (err) { /* tải sau khi dùng lần đầu */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // Trang chính: lấy bản trong bộ nhớ đệm ngay, cập nhật ngầm khi có mạng
  if (req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')))) {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const cached = await c.match('./index.html');
      const net = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await net) || new Response('Ngoại tuyến', { status: 503 });
    })());
    return;
  }
  // Còn lại (bộ nhận dạng chữ, biểu tượng, phông chữ): ưu tiên bộ nhớ đệm
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(req, { ignoreSearch: sameOrigin });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    } catch (err) { return new Response('', { status: 504 }); }
  })());
});
