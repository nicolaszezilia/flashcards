// cores.js — cor do layout (escolhida em Ajustes)
(function () {
  // e = versão para o tema escuro, c = versão para o tema claro
  const CORES = [
    { id: "menta",     nome: "Verde-menta",  e: "#5FB89E", c: "#1F5C4D" }, // padrão
    { id: "esmeralda", nome: "Esmeralda",    e: "#34D399", c: "#047857" },
    { id: "folha",     nome: "Verde-folha",  e: "#7CCB6B", c: "#3F7D2B" },
    { id: "lima",      nome: "Lima",         e: "#B5D33D", c: "#5F7A0A" },
    { id: "oliva",     nome: "Oliva",        e: "#A3B35C", c: "#5B6B1E" },
    { id: "turquesa",  nome: "Turquesa",     e: "#2DD4BF", c: "#0F766E" },
    { id: "ciano",     nome: "Ciano",        e: "#22D3EE", c: "#0E7490" },
    { id: "ceu",       nome: "Azul-céu",     e: "#5BB4F0", c: "#1D6FA5" },
    { id: "azul",      nome: "Azul",         e: "#4F8CFF", c: "#1D4ED8" },
    { id: "marinho",   nome: "Azul-marinho", e: "#7C9CF5", c: "#1E3A8A" },
    { id: "indigo",    nome: "Índigo",       e: "#818CF8", c: "#4338CA" },
    { id: "violeta",   nome: "Violeta",      e: "#A78BFA", c: "#6D28D9" },
    { id: "roxo",      nome: "Roxo",         e: "#C084FC", c: "#7E22CE" },
    { id: "magenta",   nome: "Magenta",      e: "#E879F9", c: "#A21CAF" },
    { id: "rosa",      nome: "Rosa",         e: "#F472B6", c: "#BE185D" },
    { id: "rosacha",   nome: "Rosa-chá",     e: "#F4A6B7", c: "#B0405E" },
    { id: "vinho",     nome: "Vinho",        e: "#C0566E", c: "#7F1D3A" },
    { id: "vermelho",  nome: "Vermelho",     e: "#F87171", c: "#B91C1C" },
    { id: "coral",     nome: "Coral",        e: "#FB8F73", c: "#C2410C" },
    { id: "laranja",   nome: "Laranja",      e: "#FB923C", c: "#B45309" },
    { id: "ambar",     nome: "Âmbar",        e: "#FBBF24", c: "#92400E" },
    { id: "dourado",   nome: "Dourado",      e: "#D4AF37", c: "#8A6A0A" },
    { id: "caramelo",  nome: "Caramelo",     e: "#C49A6C", c: "#7A4A21" },
    { id: "cafe",      nome: "Café",         e: "#B08968", c: "#5C3A21" },
    { id: "grafite",   nome: "Grafite",      e: "#94A3B8", c: "#334155" },
  ];
  const PADRAO = "menta";
  const CHAVE = "corLayout";

  // "#5FB89E" + 0.16 -> "rgba(95,184,158,0.16)"
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // ---------- Estilo (só desta janela) ----------
  const estiloUI = document.createElement("style");
  estiloUI.textContent = `
  #btn-cor-layout{margin-top:14px}
  .cor-ponto{width:20px;height:20px;border-radius:50%;background:var(--destaque);flex:none}
  .cores-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:12px;margin:14px 0 18px}
  .cor-bolinha{position:relative;width:44px;height:44px;padding:0;border-radius:50%;border:none;background:var(--c-e);justify-self:center}
  :root[data-tema="claro"] .cor-bolinha{background:var(--c-c)}
  .cor-bolinha.ativa{box-shadow:0 0 0 3px var(--superficie),0 0 0 5px var(--texto)}
  .cor-bolinha.ativa::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:20px;font-weight:700;text-shadow:0 0 4px rgba(0,0,0,.55)}
  `;
  document.head.appendChild(estiloUI);

  // ---------- Aplica a cor (sobrescreve as variáveis do style.css) ----------
  const estiloCor = document.createElement("style");
  document.head.appendChild(estiloCor);

  function achar(id) {
    return CORES.find((x) => x.id === id) || CORES[0];
  }

  function aplicar(id) {
    const k = achar(id);
    estiloCor.textContent =
      ":root{--destaque:" + k.e + ";--sobre-destaque:#0B1512;" +
      "--destaque-suave:" + rgba(k.e, 0.16) + ";--anel-foco:" + rgba(k.e, 0.35) + "}" +
      ':root[data-tema="claro"]{--destaque:' + k.c + ";--sobre-destaque:#FFFFFF;" +
      "--destaque-suave:" + rgba(k.c, 0.10) + ";--anel-foco:" + rgba(k.c, 0.28) + "}";
  }

  let atual = localStorage.getItem(CHAVE) || PADRAO;
  aplicar(atual); // já na abertura do app

  // ---------- Seção em Ajustes (entre Tema e Backup) ----------
  const secao = document.createElement("div");
  secao.innerHTML =
    '<h2 class="cores-titulo">Cor do layout</h2>' +
    '<p class="texto-suave" id="cor-nome"></p>' +
    '<div class="cores-grade"></div>';

  const tela = document.getElementById("tela-ajustes");
  const ref = tela.querySelector(".titulo-secao"); // o título "Backup"
  if (ref) ref.before(secao);
  else tela.appendChild(secao);

  const grade = secao.querySelector(".cores-grade");
  const rotulo = secao.querySelector("#cor-nome");

  function marcar() {
    rotulo.textContent = "Cor atual: " + achar(atual).nome;
    grade.querySelectorAll(".cor-bolinha").forEach((b) => {
      const ativa = b.dataset.cor === achar(atual).id;
      b.classList.toggle("ativa", ativa);
      b.setAttribute("aria-pressed", String(ativa));
    });
  }

  CORES.forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cor-bolinha";
    b.dataset.cor = k.id;
    b.style.setProperty("--c-e", k.e);
    b.style.setProperty("--c-c", k.c);
    b.setAttribute("aria-label", k.nome);
    b.addEventListener("click", () => {
      atual = k.id;
      localStorage.setItem(CHAVE, atual);
      aplicar(atual);
      marcar();
    });
    grade.appendChild(b);
  });

  marcar();
})();
