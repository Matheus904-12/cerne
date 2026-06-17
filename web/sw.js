// Service worker mínimo: cacheia o app shell para abrir offline.
// Dados das tarefas continuam vindo do GitHub (online) ou do localStorage (offline).
const CACHE = "cerne-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nunca cacheia chamadas de API — sempre rede.
  if (url.hostname === "api.github.com" || url.pathname.startsWith("/api/")) return;
  // App shell: cache-first.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
