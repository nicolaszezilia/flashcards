// Se você adicionar arquivos novos ao app, inclua-os na lista
// e aumente o número da versão (v3 -> v4).
const CACHE = "flashcards-v13";
const CACHE_SDK = "flashcards-sdk"; // arquivos do Firebase: não é apagado nas atualizações
const ARQUIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./import.js",
  "./export.js",
  "./db.js",
  "./srs.js",
  "./auth.js",
  "./nuvem.js",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./visual.js",
   "./limites.js",
  "./cores.js",
   "./stats.js",
];

// Instalação: guarda uma cópia nova de todos os arquivos do app
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(ARQUIVOS.map((a) => cache.add(new Request(a, { cache: "reload" }))))
      )
      .then(() => self.skipWaiting())
  );
});

// Ativação: apaga as versões antigas (menos a do Firebase)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((k) => k !== CACHE && k !== CACHE_SDK).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Arquivos do Firebase (a versão é fixa): guarda na primeira vez e depois usa do aparelho
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(
      caches.open(CACHE_SDK).then(async (cache) => {
        const guardado = await cache.match(req);
        if (guardado) return guardado;
        const resposta = await fetch(req);
        if (resposta.ok) cache.put(req, resposta.clone());
        return resposta;
      })
    );
    return;
  }

  // Arquivos do próprio app: usa a cópia do aparelho; se não tiver, vai à internet
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardado = await cache.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        try {
          return await fetch(req);
        } catch (erro) {
          if (req.mode === "navigate") return cache.match("./index.html");
          return Response.error();
        }
      })
    );
  }
  // Todo o resto (o servidor do Firebase, por exemplo) passa direto
});
