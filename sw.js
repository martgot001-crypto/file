const CACHE = "healthlog-v11";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const same = new URL(r.url).origin === self.location.origin;
  if (same) {
    // 自分のファイル: ネット優先(更新がすぐ反映)。オフライン時だけキャッシュ
    e.respondWith(
      fetch(r, { cache: "no-cache" })
        .then(res => {
          if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)).catch(() => {}); }
          return res;
        })
        .catch(() => caches.match(r).then(h => h || caches.match("index.html")))
    );
  } else {
    // 外部ライブラリ(CDN): キャッシュ優先
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const h = await c.match(r);
        if (h) return h;
        try {
          const res = await fetch(r);
          if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()).catch(() => {});
          return res;
        } catch (x) { return h; }
      })
    );
  }
});
