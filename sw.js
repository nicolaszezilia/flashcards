// Se você adicionar arquivos novos ao app, inclua-os na lista
// e aumente o número da versão (v1 -> v2).
const CACHE = "flashcards-v1";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./import.js",
  "./export.js",
  "./db.js",
  "./srs.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

// Instalação: guarda uma cópia de todos os arquivos
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: apaga cópias de versões antigas
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

// Busca: tenta a internet primeiro; se estiver offline, usa a cópia guardada
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() =>
        caches
          .match(e.request, { ignoreSearch: true })
          .then((r) => r || caches.match("./index.html"))
      )
  );
});
