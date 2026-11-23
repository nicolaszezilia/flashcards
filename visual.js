// visual.js — gamificação leve. Só LÊ os dados; não altera nada.
const META_DIA = 20; // respostas por dia para fechar o anel

const ICONES = {
  chama:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  medalha:
    '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  alvo:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
};

function icone(nome) {
  return (
    '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' + ICONES[nome] + "</svg>"
  );
}

// ---------- Datas ----------
function chaveDia(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function chaveHaDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return chaveDia(d.getTime());
}

// ---------- Cálculos ----------
async function calcularMetricas() {
  const dados = await exportarTudo();
  const revs = dados.revisoes || [];
  const dias = new Set(revs.map((r) => chaveDia(r.quando)));
  const hojeK = chaveHaDias(0);
  const hoje = revs.filter((r) => chaveDia(r.quando) === hojeK).length;

  // sequência atual (se hoje ainda não teve estudo, conta a partir de ontem)
  const inicio = dias.has(hojeK) ? 0 : dias.has(chaveHaDias(1)) ? 1 : -1;
  let streak = 0;
  if (inicio >= 0) while (dias.has(chaveHaDias(inicio + streak))) streak++;

  // maior sequência já feita
  const tempos = [...dias]
    .map((k) => {
      const [a, m, d] = k.split("-").map(Number);
      return new Date(a, m - 1, d).getTime();
    })
    .sort((x, y) => x - y);
  let maior = 0;
  let atual = 0;
  tempos.forEach((t, i) => {
    atual = i > 0 && Math.round((t - tempos[i - 1]) / 86400000) === 1 ? atual + 1 : 1;
    if (atual > maior) maior = atual;
  });

  // "meta batida" fica guardado para o selo não sumir amanhã
  if (hoje >= META_DIA) localStorage.setItem("metaBatida", "1");

  return {
    total: revs.length,
    hoje,
    streak,
    maior,
    metaBatida: localStorage.getItem("metaBatida") === "1",
  };
}

function calcularNivel(total) {
  const base = 20;
  const n = Math.floor(Math.sqrt(total / base)) + 1;
  const ini = base * (n - 1) * (n - 1);
  const fim = base * n * n;
  return { n, pct: ((total - ini) / (fim - ini)) * 100, faltam: fim - total };
}

const SELOS = [
  { id: "primeira", icone: "check", nome: "Primeira revisão", ok: (m) => m.total >= 1 },
  { id: "s3", icone: "chama", nome: "3 dias seguidos", ok: (m) => m.maior >= 3 },
  { id: "s7", icone: "chama", nome: "7 dias seguidos", ok: (m) => m.maior >= 7 },
  { id: "s30", icone: "chama", nome: "30 dias seguidos", ok: (m) => m.maior >= 30 },
  { id: "meta", icone: "alvo", nome: "Meta do dia batida", ok: (m) => m.metaBatida },
  { id: "r100", icone: "medalha", nome: "100 revisões", ok: (m) => m.total >= 100 },
  { id: "r500", icone: "medalha", nome: "500 revisões", ok: (m) => m.total >= 500 },
  { id: "r1000", icone: "medalha", nome: "1000 revisões", ok: (m) => m.total >= 1000 },
];

// ---------- Painel (aba Estudar) ----------
function desenharPainel(m) {
  const alvo = document.getElementById("estudo-vazio");
  if (!alvo) return;
  let p = document.getElementById("painel-progresso");
  if (!p) {
    p = document.createElement("div");
    p.id = "painel-progresso";
    alvo.prepend(p);
  }

  const C = 263.9; // circunferência do anel (raio 42)
  const frac = Math.min(m.hoje / META_DIA, 1);
  const nv = calcularNivel(m.total);
  const completo = m.hoje >= META_DIA;

  const textoStreak =
    m.streak === 0
      ? "Comece sua sequência hoje"
      : m.streak + (m.streak === 1 ? " dia" : " dias seguidos");
  const dica =
    m.streak > 0 && m.hoje === 0 ? '<p class="streak-dica">Estude hoje para manter a sequência</p>' : "";

  p.className = "painel" + (completo ? " completo" : "");
  p.innerHTML =
    '<div class="anel">' +
    '<svg viewBox="0 0 100 100"><circle class="anel-trilho" cx="50" cy="50" r="42"/>' +
    '<circle class="anel-fill" cx="50" cy="50" r="42"/></svg>' +
    '<div class="anel-centro"><b>' + m.hoje + "</b><small>de " + META_DIA + "</small></div></div>" +
    '<div class="painel-info">' +
    '<div class="streak' + (m.streak === 0 ? " zero" : "") + '">' + icone("chama") + "<span>" + textoStreak + "</span></div>" +
    dica +
    '<div class="nivel"><div class="nivel-topo"><span>Nível ' + nv.n + "</span><span>faltam " + nv.faltam + "</span></div>" +
    '<div class="nivel-barra"><i></i></div></div></div>';

  // dois frames depois, para a transição de preenchimento aparecer
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const c = p.querySelector(".anel-fill");
      const b = p.querySelector(".nivel-barra i");
      if (c) c.style.strokeDashoffset = C * (1 - frac);
      if (b) b.style.width = nv.pct + "%";
    })
  );
}

// ---------- Selos (aba Ajustes) ----------
function desenharSelos(m) {
  const ref = document.querySelector("#tela-ajustes .titulo-secao");
  if (!ref) return;
  let sec = document.getElementById("secao-selos");
  if (!sec) {
    sec = document.createElement("div");
    sec.id = "secao-selos";
    ref.before(sec);
  }

  let vistos = [];
  try { vistos = JSON.parse(localStorage.getItem("selosVistos") || "[]"); } catch (e) {}
  const ganhos = SELOS.filter((s) => s.ok(m));
  const qtd = ganhos.length;

  sec.innerHTML =
    '<h2 class="titulo-secao">Conquistas <span class="selos-qtd">' + qtd + "/" + SELOS.length + "</span></h2>" +
    '<div class="selos">' +
    SELOS.map((s) => {
      const ok = s.ok(m);
      const novo = ok && !vistos.includes(s.id);
      return (
        '<div class="selo' + (ok ? "" : " bloq") + (novo ? " novo" : "") + '">' +
        '<div class="disco">' + icone(s.icone) + "</div><span>" + s.nome + "</span></div>"
      );
    }).join("") +
    "</div>";

  localStorage.setItem("selosVistos", JSON.stringify(ganhos.map((s) => s.id)));
}

// ---------- Atualização ----------
async function atualizarGamificacao() {
  try {
    const m = await calcularMetricas();
    desenharPainel(m);
    desenharSelos(m);
  } catch (erro) {
    console.warn("Gamificação:", erro);
  }
}

// Atualiza sempre que a aba Estudar é desenhada
if (typeof renderizarEstudo === "function") {
  const original = renderizarEstudo;
  window.renderizarEstudo = async function () {
    await original();
    atualizarGamificacao();
  };
}

// Atualiza os selos ao abrir Ajustes
document.querySelectorAll("nav button").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.tela === "ajustes") atualizarGamificacao();
  });
});
