const titulos = {
  decks: "Meus decks",
  estudo: "Estudar",
  ajustes: "Ajustes",
};

let deckEmEdicao = null;  // null = criando um deck novo
let paiNovo = null;       // pai do subdeck que está sendo criado (null = raiz)
let deckAberto = null;    // deck cujos cartões estão na tela
let cardEmEdicao = null;  // null = criando um cartão novo
let campoAtivo = null;    // campo de texto onde o botão Negrito atua

// ---------- Texto formatado ----------
function escaparHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// [img:1] vira <img> usando a lista card.imagens; sem lista, o marcador some
function trocarImagens(html, imagens) {
  return html.replace(/\[img:(\d+)\]/g, (_, n) => {
    const src = imagens && imagens[Number(n) - 1];
    return src ? '<img class="img-card" src="' + src + '" alt="">' : "";
  });
}

// **negrito** vira <strong>, e quebra de linha vira <br>
function formatarTexto(t, imagens) {
  const html = escaparHtml(t)
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
  return trocarImagens(html, imagens);
}
// ---------- Cloze (lacunas) ----------
// Formato: {{c1::resposta}} ou {{c1::resposta::dica}}
const REGEX_CLOZE = /\{\{c\d+::(.+?)(?:::(.+?))?\}\}/gs;

const ehCloze = (card) => card.tipo === "cloze";

function temCloze(t) {
  return /\{\{c\d+::.+?\}\}/s.test(t);
}

// revelar = false: mostra [...] ; revelar = true: mostra a resposta em destaque
function formatarCloze(t, revelar, imagens) {
  const html = escaparHtml(t).replace(REGEX_CLOZE, (_, resp, dica) =>
    revelar
      ? '<span class="lacuna-resp">' + resp + "</span>"
      : '<span class="lacuna">[' + (dica || "...") + "]</span>"
  );
  return trocarImagens(
    html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>").replace(/\n/g, "<br>"),
    imagens
  );
}
// Cloze na tela de estudo: cada lacuna tem um número (data-i).
// "abertas" = quais já foram reveladas; todas = true revela tudo
function formatarClozeEstudo(t, abertas, todas, imagens) {
  let i = 0;
  const html = escaparHtml(t).replace(REGEX_CLOZE, (_, resp, dica) => {
    const n = i++;
    return todas || abertas.has(n)
      ? '<span class="lacuna-resp" data-i="' + n + '">' + resp + "</span>"
      : '<span class="lacuna" data-i="' + n + '">[' + (dica || "...") + "]</span>";
  });
  return trocarImagens(
    html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>").replace(/\n/g, "<br>"),
    imagens
  );
}
// Três pílulas: Novos / Aprender / Revisar (zerado fica apagado)
function htmlContadores(c) {
  const chip = (cls, n, rotulo) =>
    '<span class="chip ' + cls + (n === 0 ? " zero" : "") + '"><b>' + n + "</b> " + rotulo + "</span>";
  return (
    '<span class="chips">' +
    chip("c-novo", c.novos, "novos") +
    chip("c-aprender", c.aprender, "aprender") +
    chip("c-revisar", c.revisar, "revisar") +
    "</span>"
  );
}

// ---------- Navegação entre telas ----------
function mostrarTela(nome) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById("tela-" + nome).classList.add("ativa");

  const aba = nome === "deck" ? "decks" : nome;
  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.tela === aba);
  });

  document.getElementById("titulo").textContent =
    nome === "deck" ? deckAberto.nome : titulos[nome];
}

document.querySelectorAll("nav button").forEach((b) => {
  b.addEventListener("click", () => {
    mostrarTela(b.dataset.tela);
    if (b.dataset.tela === "decks") renderizarDecks();
    if (b.dataset.tela === "estudo") renderizarEstudo();
  });
});

// ---------- Tema escuro / claro ----------
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem("tema", tema);

  document.querySelectorAll(".botao-tema").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.tema === tema);
  });

  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", tema === "claro" ? "#F4F4F4" : "#0E0E0E");
}

document.querySelectorAll(".botao-tema").forEach((b) => {
  b.addEventListener("click", () => aplicarTema(b.dataset.tema));
});

// ---------- Ícone da engrenagem (acrescenta ao conjunto de ícones da página) ----------
(function () {
  const svg = document.querySelector("body > svg");
  if (!svg) return;
  svg.insertAdjacentHTML(
    "beforeend",
    '<symbol id="i-engrenagem" viewBox="0 0 24 24">' +
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
      '<circle cx="12" cy="12" r="3"/></symbol>'
  );
})();

// ---------- Árvore de decks: ajudantes ----------
// Decks recolhidos ficam guardados neste aparelho (por padrão tudo vem expandido)
function lerRecolhidos() {
  try {
    return new Set(JSON.parse(localStorage.getItem("decksRecolhidos") || "[]"));
  } catch (e) {
    return new Set();
  }
}
function guardarRecolhidos(conjunto) {
  localStorage.setItem("decksRecolhidos", JSON.stringify([...conjunto]));
}

// Lista "achatada" do que aparece na tela, na ordem certa
function linhasVisiveis(decks, recolhidos) {
  const linhas = [];
  const visitar = (paiId, nivel) => {
    filhosDe(decks, paiId).forEach((d) => {
      const filhos = filhosDe(decks, d.id);
      linhas.push({ deck: d, nivel, temFilhos: filhos.length > 0, qtdFilhos: filhos.length });
      if (filhos.length && !recolhidos.has(String(d.id))) visitar(d.id, nivel + 1);
    });
  };
  visitar(null, 0);
  return linhas;
}

// Carrega os cartões de vários decks de uma vez: Map(deckId -> cartões)
async function mapaDeCards(ids) {
  const mapa = new Map();
  for (const id of ids) mapa.set(id, await listarCards(id));
  return mapa;
}

// Soma Novos / Aprender / Revisar de todos os decks da lista de ids
function somarContadores(ids, cardsMapa, feitosMapa, filtro = null) {
  const t = { novos: 0, aprender: 0, revisar: 0 };
  const agora = Date.now();
  for (const id of ids) {
    const c = contarPendentes(cardsMapa.get(id) || [], feitosDoDeck(feitosMapa, id), agora, filtro);
    t.novos += c.novos;
    t.aprender += c.aprender;
    t.revisar += c.revisar;
  }
  return t;
}

// Recuo da linha (máximo de 5 níveis, para não estourar a tela)
// Subdecks ganham classes para ter cor própria: sub-1, sub-2, sub-3 (repete depois)
function aplicarRecuo(item, nivel) {
  item.style.marginLeft = Math.min(nivel, 5) * 12 + "px";
  if (nivel > 0) {
    item.classList.add("sub", "sub-" + (((nivel - 1) % 3) + 1));
  }
}

// Botão "−" / "+" ao lado do deck. Sem filhos: fica invisível, só para alinhar.
function criarToggle(deck, temFilhos, recolhidos, aoMudar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "deck-toggle" + (temFilhos ? "" : " sem");
  if (!temFilhos) {
    b.disabled = true;
    b.tabIndex = -1;
    b.setAttribute("aria-hidden", "true");
    return b;
  }
  const fechado = recolhidos.has(String(deck.id));
  b.textContent = fechado ? "+" : "−";
  b.setAttribute("aria-label", (fechado ? "Expandir " : "Recolher ") + deck.nome);
  b.setAttribute("aria-expanded", String(!fechado));
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const r = lerRecolhidos();
    const chave = String(deck.id);
    if (r.has(chave)) r.delete(chave);
    else r.add(chave);
    guardarRecolhidos(r);
    aoMudar();
  });
  return b;
}

// Preenche um <select> com os decks (nome completo com ::), em ordem alfabética
function opcoesDestino(selectEl, decks, permitidos, comRaiz, textoRaiz) {
  selectEl.innerHTML = "";
  const add = (valor, texto) => {
    const o = document.createElement("option");
    o.value = valor;
    o.textContent = texto;
    selectEl.appendChild(o);
  };
  if (comRaiz) add("", textoRaiz);
  permitidos
    .map((d) => ({ id: d.id, caminho: caminhoDoDeck(decks, d.id) }))
    .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"))
    .forEach((x) => add(String(x.id), x.caminho));
}

// ---------- Lista de decks (árvore) ----------
async function renderizarDecks() {
  const decks = await listarDecks();
  const feitosMapa = await feitosHojePorDeck();
  const cardsMapa = await mapaDeCards(decks.map((d) => d.id));
  const recolhidos = lerRecolhidos();

  const lista = document.getElementById("lista-decks");
  lista.innerHTML = "";
  document.getElementById("vazio-decks").classList.toggle("oculto", decks.length > 0);

  for (const { deck, nivel, temFilhos, qtdFilhos } of linhasVisiveis(decks, recolhidos)) {
    const ids = idsDaSubarvore(decks, deck.id);
    const qtd = ids.reduce((s, id) => s + (cardsMapa.get(id) || []).length, 0);
    const pend = somarContadores(ids, cardsMapa, feitosMapa);

    const item = document.createElement("div");
    item.className = "deck-item";
    aplicarRecuo(item, nivel);

    const toggle = criarToggle(deck, temFilhos, recolhidos, renderizarDecks);

    const info = document.createElement("div");
    info.className = "deck-info";
    const nome = document.createElement("span");
    nome.className = "deck-nome";
    nome.textContent = deck.nome;
    const contador = document.createElement("span");
    contador.className = "deck-qtd";
    contador.textContent =
      qtd + (qtd === 1 ? " cartão" : " cartões") +
      (temFilhos ? " · " + qtdFilhos + (qtdFilhos === 1 ? " subdeck" : " subdecks") : "");
    const pendentes = document.createElement("span");
    pendentes.className = "deck-qtd";
    pendentes.innerHTML = htmlContadores(pend);
    info.append(nome, contador, pendentes);
    info.addEventListener("click", () => abrirDeck(deck));

    const btnMenu = document.createElement("button");
    btnMenu.className = "deck-editar";
    btnMenu.innerHTML = '<svg class="ico"><use href="#i-engrenagem"/></svg>';
    btnMenu.setAttribute("aria-label", "Opções do deck " + deck.nome);
    btnMenu.addEventListener("click", () => abrirMenuDeck(deck));

    item.append(toggle, info, btnMenu);
    lista.appendChild(item);
  }
}

// ---------- Menu da engrenagem ----------
let deckDoMenu = null;

const menuDeck = document.createElement("div");
menuDeck.id = "menu-deck";
menuDeck.className = "modal oculto";
menuDeck.innerHTML =
  '<div class="modal-caixa">' +
  '<h2 id="menu-deck-titulo"></h2>' +
  '<button class="btn" data-acao="sub">Adicionar subdeck</button>' +
  '<button class="btn" data-acao="renomear">Renomear</button>' +
  '<button class="btn" data-acao="mover">Mover</button>' +
  '<button class="btn perigo" data-acao="excluir">Excluir</button>' +
  '<button class="btn" data-acao="fechar">Cancelar</button>' +
  "</div>";
document.body.appendChild(menuDeck);

function abrirMenuDeck(deck) {
  deckDoMenu = deck;
  document.getElementById("menu-deck-titulo").textContent = deck.nome;
  menuDeck.classList.remove("oculto");
}
function fecharMenuDeck() {
  menuDeck.classList.add("oculto");
  deckDoMenu = null;
}
menuDeck.addEventListener("click", (e) => {
  if (e.target === menuDeck) return fecharMenuDeck();
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;
  const deck = deckDoMenu;
  fecharMenuDeck();
  if (!deck) return;
  const acao = botao.dataset.acao;
  if (acao === "sub") abrirModal(null, deck);
  else if (acao === "renomear") abrirModal(deck);
  else if (acao === "mover") abrirModalMover(deck);
  else if (acao === "excluir") abrirModalExcluir(deck);
});

// ---------- Janela de criar / renomear deck ----------
function abrirModal(deck = null, pai = null) {
  deckEmEdicao = deck;
  paiNovo = pai ? pai.id : null;
  document.getElementById("modal-titulo").textContent = deck
    ? "Renomear deck"
    : pai
    ? 'Novo subdeck em "' + pai.nome + '"'
    : "Novo deck";
  document.getElementById("input-nome").value = deck ? deck.nome : "";
  document.getElementById("btn-apagar").classList.add("oculto"); // excluir agora fica no menu ⚙️
  document.getElementById("modal").classList.remove("oculto");
  document.getElementById("input-nome").focus();
}

function fecharModal() {
  document.getElementById("modal").classList.add("oculto");
  deckEmEdicao = null;
  paiNovo = null;
}

async function salvarModal() {
  const input = document.getElementById("input-nome");
  const nome = input.value.trim();
  if (!nome) {
    input.focus();
    return;
  }
  if (nome.includes("::")) {
    alert('O nome não pode conter "::" (esse símbolo separa os níveis na importação).');
    input.focus();
    return;
  }

  const decks = await listarDecks();
  const atual = deckEmEdicao ? decks.find((d) => d.id === deckEmEdicao.id) || deckEmEdicao : null;
  const pai = atual ? atual.parentId ?? null : paiNovo;

  if (nomeDuplicado(decks, pai, nome, atual ? atual.id : null)) {
    alert('Já existe um deck chamado "' + nome + '" aqui. Escolha outro nome.');
    input.focus();
    return;
  }

  if (atual) {
    await salvarDeck({ ...atual, nome });
  } else {
    await salvarDeck({ nome, parentId: pai, criadoEm: Date.now() });
    if (pai !== null) {
      // garante que o pai apareça expandido para você ver o subdeck novo
      const r = lerRecolhidos();
      r.delete(String(pai));
      guardarRecolhidos(r);
    }
  }

  fecharModal();
  renderizarDecks();
}

document.getElementById("btn-novo-deck").addEventListener("click", () => abrirModal());
document.getElementById("btn-salvar").addEventListener("click", salvarModal);
document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
document.getElementById("input-nome").addEventListener("keydown", (e) => {
  if (e.key === "Enter") salvarModal();
});

// ---------- Janela de mover deck ----------
let deckParaMover = null;

const modalMover = document.createElement("div");
modalMover.id = "modal-mover";
modalMover.className = "modal oculto";
modalMover.innerHTML =
  '<div class="modal-caixa">' +
  '<h2 id="mover-titulo"></h2>' +
  '<label for="mover-destino">Novo deck pai</label>' +
  '<select id="mover-destino" class="sel-deck"></select>' +
  '<button id="mover-ok" class="btn principal">Mover</button>' +
  '<button id="mover-cancelar" class="btn">Cancelar</button>' +
  "</div>";
document.body.appendChild(modalMover);

async function abrirModalMover(deck) {
  const decks = await listarDecks();
  const proibidos = idsDaSubarvore(decks, deck.id); // nem ele mesmo, nem seus descendentes
  deckParaMover = deck;
  document.getElementById("mover-titulo").textContent = 'Mover "' + deck.nome + '"';
  const sel = document.getElementById("mover-destino");
  opcoesDestino(sel, decks, decks.filter((d) => !proibidos.includes(d.id)), true, "— Raiz (sem deck pai) —");
  const atual = decks.find((d) => d.id === deck.id);
  sel.value = atual && atual.parentId !== null ? String(atual.parentId) : "";
  modalMover.classList.remove("oculto");
}
function fecharModalMover() {
  modalMover.classList.add("oculto");
  deckParaMover = null;
}
document.getElementById("mover-cancelar").addEventListener("click", fecharModalMover);
modalMover.addEventListener("click", (e) => {
  if (e.target === modalMover) fecharModalMover();
});
document.getElementById("mover-ok").addEventListener("click", async () => {
  if (!deckParaMover) return;
  const v = document.getElementById("mover-destino").value;
  const destino = v === "" ? null : Number(v);
  try {
    await moverDeck(deckParaMover.id, destino);
    if (destino !== null) {
      const r = lerRecolhidos();
      r.delete(String(destino));
      guardarRecolhidos(r);
    }
    fecharModalMover();
    renderizarDecks();
  } catch (erro) {
    alert(erro.message);
  }
});

// ---------- Janela de excluir deck ----------
let excluirCtx = null;

const modalExcluir = document.createElement("div");
modalExcluir.id = "modal-excluir";
modalExcluir.className = "modal oculto";
modalExcluir.innerHTML =
  '<div class="modal-caixa">' +
  '<h2 id="exc-titulo"></h2>' +
  '<p id="exc-resumo" class="texto-suave"></p>' +
  '<div id="exc-opcoes">' +
  '<button type="button" id="exc-tudo" class="btn opcao ativa">Excluir o deck, os subdecks e os cartões</button>' +
  '<button type="button" id="exc-mover" class="btn opcao">Mover subdecks e cartões para outro deck e excluir só este</button>' +
  '<div id="exc-destino-bloco" class="oculto">' +
  '<label for="exc-destino">Enviar para</label>' +
  '<select id="exc-destino" class="sel-deck"></select>' +
  "</div>" +
  "</div>" +
  '<button id="exc-ok" class="btn perigo">Excluir</button>' +
  '<button id="exc-cancelar" class="btn">Cancelar</button>' +
  "</div>";
document.body.appendChild(modalExcluir);

function definirModoExcluir(modo) {
  excluirCtx.modo = modo;
  document.getElementById("exc-tudo").classList.toggle("ativa", modo === "tudo");
  document.getElementById("exc-mover").classList.toggle("ativa", modo === "mover");
  document.getElementById("exc-destino-bloco").classList.toggle("oculto", modo !== "mover");
}

async function abrirModalExcluir(deck) {
  const decks = await listarDecks();
  const ids = idsDaSubarvore(decks, deck.id);
  const cardsMapa = await mapaDeCards(ids);
  const qtdCards = ids.reduce((s, id) => s + cardsMapa.get(id).length, 0);
  const proprios = cardsMapa.get(deck.id).length;
  const qtdSub = ids.length - 1;
  const vazio = qtdSub === 0 && qtdCards === 0;

  excluirCtx = { deck, decks, ids, qtdSub, qtdCards, vazio, modo: "tudo" };

  document.getElementById("exc-titulo").textContent = 'Excluir "' + deck.nome + '"';
  document.getElementById("exc-resumo").textContent = vazio
    ? "Este deck está vazio."
    : "Tem " + qtdSub + (qtdSub === 1 ? " subdeck" : " subdecks") +
      " e " + qtdCards + (qtdCards === 1 ? " cartão" : " cartões") + " (contando os subdecks).";
  document.getElementById("exc-opcoes").classList.toggle("oculto", vazio);

  // Destinos possíveis: qualquer deck fora desta árvore. A raiz só vale se o deck não tem cartões próprios.
  const sel = document.getElementById("exc-destino");
  opcoesDestino(
    sel,
    decks,
    decks.filter((d) => !ids.includes(d.id)),
    proprios === 0,
    "— Raiz (subdecks ficam sem pai) —"
  );
  document.getElementById("exc-mover").disabled = sel.options.length === 0;

  definirModoExcluir("tudo");
  modalExcluir.classList.remove("oculto");
}

function fecharModalExcluir() {
  modalExcluir.classList.add("oculto");
  excluirCtx = null;
}

document.getElementById("exc-tudo").addEventListener("click", () => excluirCtx && definirModoExcluir("tudo"));
document.getElementById("exc-mover").addEventListener("click", () => excluirCtx && definirModoExcluir("mover"));
document.getElementById("exc-cancelar").addEventListener("click", fecharModalExcluir);
modalExcluir.addEventListener("click", (e) => {
  if (e.target === modalExcluir) fecharModalExcluir();
});

document.getElementById("exc-ok").addEventListener("click", async () => {
  const c = excluirCtx;
  if (!c) return;

  let destino = null;
  let texto;
  if (c.modo === "mover") {
    const v = document.getElementById("exc-destino").value;
    destino = v === "" ? null : Number(v);
    const nomeDestino = destino === null ? "a raiz" : '"' + caminhoDoDeck(c.decks, destino) + '"';
    texto =
      'Mover os subdecks e os cartões de "' + c.deck.nome + '" para ' + nomeDestino +
      ' e depois excluir só o deck "' + c.deck.nome + '"?';
  } else if (c.vazio) {
    texto = 'Excluir o deck "' + c.deck.nome + '"?';
  } else {
    texto =
      'APAGAR DEFINITIVAMENTE o deck "' + c.deck.nome + '", ' + c.qtdSub + " subdeck(s) e " +
      c.qtdCards + " cartão(ões)?\n\nIsso não pode ser desfeito.";
  }
  if (!confirm(texto)) return;

  const botao = document.getElementById("exc-ok");
  botao.disabled = true; // evita toque duplo
  try {
    await apagarDeckArvore(c.deck.id, c.modo, destino);
    if (destino !== null) {
      const r = lerRecolhidos();
      r.delete(String(destino));
      guardarRecolhidos(r);
    }
    fecharModalExcluir();
    renderizarDecks();
  } catch (erro) {
    alert("Não consegui excluir: " + erro.message);
  } finally {
    botao.disabled = false;
  }
});

// ---------- Busca nos cartões ----------
const inputBusca = document.createElement("input");
inputBusca.type = "search";
inputBusca.id = "input-busca";
inputBusca.placeholder = "Buscar (texto ou #tag)";
inputBusca.autocapitalize = "none";
inputBusca.autocomplete = "off";
inputBusca.setAttribute("aria-label", "Buscar cartões");

const msgBusca = document.createElement("p");
msgBusca.id = "msg-busca";
msgBusca.className = "oculto";

const listaCardsEl = document.getElementById("lista-cards");
listaCardsEl.before(inputBusca);
listaCardsEl.before(msgBusca);

// Tira acentos e maiúsculas: "Tríade" vira "triade"
function semAcento(t) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Todas as palavras da busca precisam combinar.
// Palavra com # procura nas tags; as outras procuram em frente, verso e tags.
function cardCombina(card, busca) {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const tags = (card.tags || []).map(semAcento);
  const texto = semAcento(card.frente + " " + card.verso) + " " + tags.join(" ");
  return termos.every((t) => {
    if (t === "#") return true;
    if (t.startsWith("#")) return tags.some((g) => g.startsWith(t.slice(1)));
    return texto.includes(t);
  });
}

// Espera 0,2 s depois da última tecla antes de filtrar
let temporizadorBusca = null;
inputBusca.addEventListener("input", () => {
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(renderizarCards, 200);
});

// ---------- Tela de um deck (lista de cartões) ----------
function abrirDeck(deck) {
  inputBusca.value = "";
  deckAberto = deck;
  mostrarTela("deck");
  renderizarCards();
}

async function renderizarCards() {
  const cards = await listarCards(deckAberto.id);
  cards.sort((a, b) => a.criadoEm - b.criadoEm);

  // Contadores do deck + todos os subdecks
  const decks = await listarDecks();
  const ids = idsDaSubarvore(decks, deckAberto.id);
  const feitosMapa = await feitosHojePorDeck();
  const cardsMapa = await mapaDeCards(ids);
  document.getElementById("deck-contadores").innerHTML =
    htmlContadores(somarContadores(ids, cardsMapa, feitosMapa));

  // Filtro da busca
  const busca = inputBusca.value.trim();
  const visiveis = busca ? cards.filter((c) => cardCombina(c, busca)) : cards;
  msgBusca.classList.toggle("oculto", !busca);
  msgBusca.textContent = visiveis.length
    ? visiveis.length + " de " + cards.length + (cards.length === 1 ? " cartão" : " cartões")
    : "Nenhum cartão encontrado.";

  const lista = document.getElementById("lista-cards");
  lista.innerHTML = "";
  document.getElementById("vazio-cards").classList.toggle("oculto", cards.length > 0);

  visiveis.forEach((card) => {
    const item = document.createElement("div");
    item.className = "card-item";

    const frente = document.createElement("div");
    frente.className = "card-frente";
   frente.innerHTML = ehCloze(card) ? formatarCloze(card.frente, true, card.imagens) : formatarTexto(card.frente, card.imagens);

    const verso = document.createElement("div");
    verso.className = "card-verso";
    verso.innerHTML = formatarTexto(card.verso);

    item.append(frente);
    if (card.verso) item.append(verso);

    if (card.tags && card.tags.length) {
      const linhaTags = document.createElement("div");
      linhaTags.className = "card-tags";
      card.tags.forEach((t) => {
        const chip = document.createElement("span");
        chip.className = "tag";
        chip.textContent = t;
        // Tocar na tag filtra por ela (sem abrir o cartão)
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          inputBusca.value = "#" + t;
          renderizarCards();
        });
        linhaTags.appendChild(chip);
      });
      item.appendChild(linhaTags);
    }

    item.addEventListener("click", () => abrirModalCard(card));
    lista.appendChild(item);
  });
}

document.getElementById("btn-voltar").addEventListener("click", () => {
  mostrarTela("decks");
  renderizarDecks();
});

// ---------- Tags ----------
// Cria o campo de tags embaixo do verso, na janela do cartão
const inputTags = document.createElement("input");
inputTags.type = "text";
inputTags.id = "input-tags";
inputTags.placeholder = "Tags, separadas por espaço (ex.: cardio ecg)";
inputTags.autocapitalize = "none";
inputTags.autocomplete = "off";
inputTags.setAttribute("aria-label", "Tags");
document.getElementById("input-verso").after(inputTags);

// "Cardio, #ECG  ecg" vira ["cardio", "ecg"]
function lerTags(texto) {
  const vistos = new Set();
  texto.split(/[\s,;]+/).forEach((t) => {
    t = t.replace(/^#+/, "").toLowerCase();
    if (t) vistos.add(t);
  });
  return [...vistos];
}

// ---------- Tipo do cartão: básico ou cloze ----------
const barraTipo = document.createElement("div");
barraTipo.id = "barra-tipo";

const selectTipo = document.createElement("select");
selectTipo.id = "select-tipo";
selectTipo.setAttribute("aria-label", "Tipo de cartão");
selectTipo.innerHTML =
  '<option value="basico">Básico (frente e verso)</option>' +
  '<option value="cloze">Cloze (lacuna)</option>';

const btnLacuna = document.createElement("button");
btnLacuna.type = "button";
btnLacuna.id = "btn-lacuna";
btnLacuna.textContent = "[...] Lacuna";
btnLacuna.classList.add("oculto");

barraTipo.append(selectTipo, btnLacuna);
document.getElementById("input-frente").before(barraTipo);

function ajustarTipo() {
  const cloze = selectTipo.value === "cloze";
  btnLacuna.classList.toggle("oculto", !cloze);
  document.getElementById("input-frente").placeholder = cloze
    ? "Ex.: A {{c1::insulina}} reduz a glicemia"
    : "Frente";
  document.getElementById("input-verso").placeholder = cloze
    ? "Extra (opcional): explicação ou fonte"
    : "Verso";
}
selectTipo.addEventListener("change", ajustarTipo);

// Envolve o trecho selecionado na frente com {{c1:: }}
function aplicarLacuna() {
  const campo = document.getElementById("input-frente");
  const ini = campo.selectionStart;
  const fim = campo.selectionEnd;
  if (ini === fim) {
    alert("Primeiro selecione a palavra ou o trecho que vai virar lacuna.");
    return;
  }
  const sel = campo.value.slice(ini, fim);
  campo.value = campo.value.slice(0, ini) + "{{c1::" + sel + "}}" + campo.value.slice(fim);
  campo.focus();
  campo.setSelectionRange(ini + 6, ini + 6 + sel.length);
}
btnLacuna.addEventListener("click", aplicarLacuna);
// ---------- Janela de criar / editar cartão ----------
function abrirModalCard(card = null) {
  cardEmEdicao = card;
  document.getElementById("modal-card-titulo").textContent = card ? "Editar cartão" : "Novo cartão";
  document.getElementById("input-frente").value = card ? card.frente : "";
  document.getElementById("input-verso").value = card ? card.verso : "";
  inputTags.value = card && card.tags ? card.tags.join(" ") : "";
  selectTipo.value = card && card.tipo === "cloze" ? "cloze" : "basico";
  ajustarTipo();
  document.getElementById("btn-apagar-card").classList.toggle("oculto", !card);
  document.getElementById("modal-card").classList.remove("oculto");
  document.getElementById("input-frente").focus();
}

function fecharModalCard() {
  document.getElementById("modal-card").classList.add("oculto");
  cardEmEdicao = null;
}

async function salvarModalCard() {
  const campoFrente = document.getElementById("input-frente");
  const campoVerso = document.getElementById("input-verso");
  const frente = campoFrente.value.trim();
  const verso = campoVerso.value.trim();
  const cloze = selectTipo.value === "cloze";

  if (!frente) {
    campoFrente.focus();
    return;
  }
  if (cloze && !temCloze(frente)) {
    alert("Marque pelo menos uma lacuna: selecione um trecho e toque em [...] Lacuna.");
    campoFrente.focus();
    return;
  }
  if (!cloze && !verso) {
    campoVerso.focus();
    return;
  }

  const tags = lerTags(inputTags.value);
  const tipo = cloze ? "cloze" : "basico";
  if (cardEmEdicao) {
    await salvarCard({ ...cardEmEdicao, frente, verso, tags, tipo });
  } else {
    await salvarCard({ deckId: deckAberto.id, frente, verso, tags, tipo, criadoEm: Date.now() });
  }

  fecharModalCard();
  renderizarCards();
}

async function apagarModalCard() {
  if (!confirm("Apagar este cartão?")) return;
  await apagarCard(cardEmEdicao.id);
  fecharModalCard();
  renderizarCards();
}

// Envolve o texto selecionado com ** ** (negrito)
function aplicarNegrito() {
  const campo = campoAtivo || document.getElementById("input-frente");
  const ini = campo.selectionStart;
  const fim = campo.selectionEnd;
  const selecionado = campo.value.slice(ini, fim);

  campo.value = campo.value.slice(0, ini) + "**" + selecionado + "**" + campo.value.slice(fim);
  campo.focus();
  campo.setSelectionRange(ini + 2, ini + 2 + selecionado.length);
}

["input-frente", "input-verso"].forEach((id) => {
  document.getElementById(id).addEventListener("focus", (e) => {
    campoAtivo = e.target;
  });
});

document.getElementById("btn-novo-card").addEventListener("click", () => abrirModalCard());
document.getElementById("btn-negrito").addEventListener("click", aplicarNegrito);
document.getElementById("btn-salvar-card").addEventListener("click", salvarModalCard);
document.getElementById("btn-apagar-card").addEventListener("click", apagarModalCard);
document.getElementById("btn-cancelar-card").addEventListener("click", fecharModalCard);

// ---------- Filtro de estudo (todos / errados / tag) ----------
let filtroEstudo = { tipo: "todos", tag: "" };

const selectFiltro = document.createElement("select");
selectFiltro.id = "filtro-estudo";
selectFiltro.setAttribute("aria-label", "Filtro de estudo");
document.getElementById("lista-estudo").before(selectFiltro);

// Recria as opções (as tags mudam conforme seus cartões)
function popularFiltro(tags) {
  selectFiltro.innerHTML = "";
  const add = (valor, texto) => {
    const o = document.createElement("option");
    o.value = valor;
    o.textContent = texto;
    selectFiltro.appendChild(o);
  };
  add("todos", "Todos os cartões do dia");
  add("errados", "Só os que já errei");
  [...tags]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((t) => add("tag:" + t, "Tag: #" + t));

  const atual = filtroEstudo.tipo === "tag" ? "tag:" + filtroEstudo.tag : filtroEstudo.tipo;
  const existe = [...selectFiltro.options].some((o) => o.value === atual);
  if (!existe) filtroEstudo = { tipo: "todos", tag: "" };
  selectFiltro.value = existe ? atual : "todos";
}

selectFiltro.addEventListener("change", () => {
  const v = selectFiltro.value;
  filtroEstudo = v.startsWith("tag:")
    ? { tipo: "tag", tag: v.slice(4) }
    : { tipo: v, tag: "" };
  renderizarEstudo();
});

// ---------- Aba Estudar (árvore de decks com contadores) ----------
async function renderizarEstudo() {
  const decks = await listarDecks();
  const feitosMapa = await feitosHojePorDeck();
  const cardsMapa = await mapaDeCards(decks.map((d) => d.id));
  const recolhidos = lerRecolhidos();

  const todasTags = new Set();
  cardsMapa.forEach((cs) => cs.forEach((x) => (x.tags || []).forEach((t) => todasTags.add(t))));
  popularFiltro(todasTags);

  const lista = document.getElementById("lista-estudo");
  lista.innerHTML = "";
  document.getElementById("estudo-nada").classList.toggle("oculto", decks.length > 0);

  let totalHoje = 0;

  for (const { deck, nivel, temFilhos } of linhasVisiveis(decks, recolhidos)) {
    const ids = idsDaSubarvore(decks, deck.id);
    const c = somarContadores(ids, cardsMapa, feitosMapa, filtroEstudo);
    const total = c.novos + c.aprender + c.revisar;
    if (nivel === 0) totalHoje += total; // o deck da raiz já inclui os subdecks

    const item = document.createElement("div");
    item.className = "deck-item";
    aplicarRecuo(item, nivel);

    const toggle = criarToggle(deck, temFilhos, recolhidos, renderizarEstudo);

    const info = document.createElement("div");
    info.className = "deck-info";
    const nome = document.createElement("span");
    nome.className = "deck-nome";
    nome.textContent = deck.nome;
    const pendentes = document.createElement("span");
    pendentes.className = "deck-qtd";
    pendentes.innerHTML = htmlContadores(c);
    info.append(nome, pendentes);

    const btn = document.createElement("button");
    btn.className = "btn-estudar-deck";
    btn.textContent = "Estudar";
    btn.disabled = total === 0;
    btn.addEventListener("click", () => iniciarEstudo(deck, "tab", { ...filtroEstudo }));

    item.append(toggle, info, btn);
    lista.appendChild(item);
  }

  const resumo = document.getElementById("resumo-hoje");
  if (decks.length === 0) {
    resumo.textContent = "";
  } else if (totalHoje === 0) {
    resumo.textContent =
      filtroEstudo.tipo === "todos"
        ? "Tudo em dia por hoje"
        : "Nada pendente hoje neste filtro.";
  } else {
    resumo.innerHTML =
      '<b class="num-hoje">' + totalHoje + "</b>" +
      (totalHoje === 1 ? " cartão" : " cartões") + " para estudar hoje";
  }
}

// ---------- Estudo ----------
let sessao = null; // { fila, respondidos, revelado, origem }

async function iniciarEstudo(deck, origem, filtro = null) {
  if (deck) deckAberto = deck;

  // Estuda o deck e todos os subdecks juntos
  const decks = await listarDecks();
  const ids = idsDaSubarvore(decks, deckAberto.id);
  const feitosMapa = await feitosHojePorDeck();
  const agora = Date.now();

  let totalCards = 0;
  const pendentes = [];
  const novos = [];
  for (const id of ids) {
    const cards = await listarCards(id);
    totalCards += cards.length;
    // cada deck respeita o seu próprio limite diário
    montarFila(cards, feitosDoDeck(feitosMapa, id), agora, filtro).forEach((c) => {
      if (estadoDoCard(c) === "novo") novos.push(c);
      else pendentes.push(c);
    });
  }

  if (totalCards === 0) {
    alert("Este deck (e seus subdecks) ainda não tem cartões. Crie alguns primeiro.");
    return;
  }

  pendentes.sort((a, b) => a.proxima - b.proxima);
  novos.sort((a, b) => a.criadoEm - b.criadoEm);
  const fila = [...pendentes, ...novos];

  if (fila.length === 0) {
    alert("Nada para estudar neste deck agora (ou o limite de hoje já foi atingido). 🎉");
    return;
  }

  sessao = { fila, respondidos: 0, revelado: false, origem: origem || "deck" };
  document.body.classList.add("estudando");
  mostrarTela("estudo");
  document.getElementById("titulo").textContent = deckAberto.nome;

  document.getElementById("estudo-vazio").classList.add("oculto");
  document.getElementById("estudo-fim").classList.add("oculto");
  document.getElementById("estudo-sessao").classList.remove("oculto");
  mostrarProximoCard();
}

function mostrarProximoCard() {
  if (sessao.fila.length === 0) {
    terminarEstudo();
    return;
  }

  const card = sessao.fila[0];
  sessao.revelado = false;

  document.getElementById("estudo-progresso").textContent = "Restam " + sessao.fila.length;
  // Visual: barra de progresso e entrada suave do cartão
  const feitos = sessao.respondidos;
  const totalSessao = feitos + sessao.fila.length;
  document.getElementById("barra-sessao-fill").style.width =
    (totalSessao ? (feitos / totalSessao) * 100 : 0) + "%";
  const cartaoEl = document.getElementById("estudo-card");
  cartaoEl.classList.remove("entra");
  void cartaoEl.offsetWidth; // reinicia a animação
  cartaoEl.classList.add("entra");
    sessao.abertas = new Set();
  document.getElementById("estudo-frente").innerHTML = ehCloze(card)
    ? formatarClozeEstudo(card.frente, sessao.abertas, false)
    : formatarTexto(card.frente);
  document.getElementById("estudo-verso").innerHTML = formatarTexto(card.verso || "");
  document.getElementById("estudo-verso").classList.add("oculto");
  document.getElementById("estudo-linha").classList.add("oculto");
  document.getElementById("notas").classList.add("oculto");
  document.getElementById("btn-mostrar").classList.remove("oculto");
  document.getElementById("estudo-acoes").classList.remove("oculto");
  window.scrollTo(0, 0);
}

function revelarResposta() {
  if (!sessao || sessao.revelado) return;
  sessao.revelado = true;

  const card = sessao.fila[0];
  if (ehCloze(card)) {
        document.getElementById("estudo-frente").innerHTML = formatarClozeEstudo(card.frente, sessao.abertas, true);
  }
    if (!ehCloze(card) || card.verso) {
    document.getElementById("estudo-verso").classList.remove("oculto");
  }
  document.getElementById("estudo-linha").classList.remove("oculto");
  document.getElementById("btn-mostrar").classList.add("oculto");
  document.getElementById("notas").classList.remove("oculto");

  [0, 1, 2, 3].forEach((n) => {
    document.getElementById("prev-" + n).textContent = textoPrevia(card, n);
  });
}

async function responder(nota) {
  if (!sessao || !sessao.revelado) return;
  sessao.revelado = false; // evita toque duplo

  const card = sessao.fila.shift();
  const atualizado = calcularRevisao(card, nota);

  await salvarCard(atualizado);
  await salvarRevisao({
    cardId: card.id,
    deckId: card.deckId,
    nota: nota,
    estadoAntes: estadoDoCard(card),
    quando: Date.now(),
  });

  sessao.respondidos += 1;
  if (atualizado.estado === "aprendendo") sessao.fila.push(atualizado);
  mostrarProximoCard();
}

function terminarEstudo() {
  document.getElementById("estudo-sessao").classList.add("oculto");
  document.getElementById("estudo-acoes").classList.add("oculto");
  document.getElementById("estudo-resumo").textContent =
    "Você respondeu " + sessao.respondidos + " vezes nesta sessão.";
  document.getElementById("estudo-fim").classList.remove("oculto");
}

function sairDoEstudo() {
  const origem = sessao ? sessao.origem : "deck";
  sessao = null;

  document.body.classList.remove("estudando");
  document.getElementById("estudo-sessao").classList.add("oculto");
  document.getElementById("estudo-acoes").classList.add("oculto");
  document.getElementById("estudo-fim").classList.add("oculto");
  document.getElementById("estudo-vazio").classList.remove("oculto");

  if (origem === "tab") {
    mostrarTela("estudo");
    renderizarEstudo();
  } else {
    mostrarTela("deck");
    renderizarCards();
  }
}
// Revela só a lacuna tocada; se foi a última, mostra os botões de nota
function abrirLacuna(n) {
  const card = sessao.fila[0];
  sessao.abertas.add(n);
  document.getElementById("estudo-frente").innerHTML =
    formatarClozeEstudo(card.frente, sessao.abertas, false);
  const total = (card.frente.match(REGEX_CLOZE) || []).length;
  if (sessao.abertas.size >= total) revelarResposta();
}
document.getElementById("btn-estudar").addEventListener("click", () => iniciarEstudo(null, "deck"));
document.getElementById("estudo-card").addEventListener("click", (e) => {
  if (sessao && !sessao.revelado && ehCloze(sessao.fila[0])) {
    const alvo = e.target.closest(".lacuna");
    if (alvo) abrirLacuna(Number(alvo.dataset.i)); // cloze: só abre a lacuna tocada
    return;
  }
  revelarResposta(); // cartão básico: toque em qualquer lugar mostra o verso
});
document.getElementById("btn-mostrar").addEventListener("click", revelarResposta);
document.getElementById("btn-sair-estudo").addEventListener("click", sairDoEstudo);
document.getElementById("btn-fim-estudo").addEventListener("click", sairDoEstudo);
document.querySelectorAll(".nota").forEach((b) => {
  b.addEventListener("click", () => responder(Number(b.dataset.nota)));
});

// ---------- Backup (exportar / importar) ----------
function dataLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function mostrarUltimoBackup() {
  const ts = Number(localStorage.getItem("ultimoBackup"));
  document.getElementById("ultimo-backup").textContent = ts
    ? "Último backup: " + new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "Você ainda não fez nenhum backup.";
}

function baixarArquivo(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportarBackup() {
  try {
    const dados = await exportarTudo();
    const backup = {
      app: "flashcards",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      decks: dados.decks,
      cards: dados.cards,
      revisoes: dados.revisoes,
    };
    const nome = "flashcards-backup-" + dataLocal() + ".json";
    const arquivo = new File([JSON.stringify(backup)], nome, { type: "application/json" });

    // No celular, abre a folha de compartilhar; no PC, baixa direto
    const ehToque = window.matchMedia("(pointer: coarse)").matches;
    let compartilhou = false;
    if (ehToque && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: "Backup Flashcards" });
        compartilhou = true;
      } catch (erro) {
        if (erro.name === "AbortError") return; // você cancelou
      }
    }
    if (!compartilhou) baixarArquivo(arquivo);

    localStorage.setItem("ultimoBackup", String(Date.now()));
    mostrarUltimoBackup();
  } catch (erro) {
    alert("Não consegui exportar: " + erro);
  }
}

function validarBackup(d) {
  if (!d || d.app !== "flashcards" || !Array.isArray(d.decks) || !Array.isArray(d.cards)) {
    throw new Error("este arquivo não é um backup do Flashcards.");
  }
  const idsDecks = new Set();
  for (const deck of d.decks) {
    if (typeof deck.id !== "number" || typeof deck.nome !== "string") {
      throw new Error("há um deck inválido no arquivo.");
    }
    idsDecks.add(deck.id);
  }
  for (const c of d.cards) {
    if (
      typeof c.id !== "number" ||
      !idsDecks.has(c.deckId) ||
      typeof c.frente !== "string" ||
      typeof c.verso !== "string"
    ) {
      throw new Error("há um cartão inválido no arquivo.");
    }
  }
}

async function importarBackup(arquivo) {
  if (window.nuvem && window.nuvem.pronta) {
    alert("Com a sincronização ligada, importar backup ainda não está liberado (chega em uma próxima etapa). A importação de cartões por texto/CSV funciona normalmente.");
    return;
  }
  try {
    const dados = JSON.parse(await arquivo.text());
    validarBackup(dados);

    const aviso =
      "Importar backup com " + dados.decks.length + " deck(s) e " + dados.cards.length +
      " cartão(ões)?\n\nISSO APAGA tudo que está neste aparelho e coloca o conteúdo do backup no lugar.";
    if (!confirm(aviso)) return;

    await substituirTudo(dados);
    deckAberto = null;
    renderizarDecks();
    alert("Backup importado com sucesso!");
  } catch (erro) {
    alert("Não consegui importar: " + erro.message);
  }
}

document.getElementById("btn-exportar").addEventListener("click", exportarBackup);
document.getElementById("btn-importar").addEventListener("click", () => {
  document.getElementById("input-importar").click();
});
document.getElementById("input-importar").addEventListener("change", (e) => {
  const arquivo = e.target.files[0];
  e.target.value = ""; // permite escolher o mesmo arquivo de novo
  if (arquivo) importarBackup(arquivo);
});
// ---------- Atualiza a tela quando chegam dados da nuvem ----------
let temporizadorAtualizar = null;
window.atualizarTela = function () {
  clearTimeout(temporizadorAtualizar);
  temporizadorAtualizar = setTimeout(() => {
    if (sessao) return; // não interrompe um estudo em andamento
    const ativa = document.querySelector(".tela.ativa");
    if (!ativa) return;
    const nome = ativa.id.replace("tela-", "");
    if (nome === "decks") renderizarDecks();
    else if (nome === "estudo") renderizarEstudo();
    else if (nome === "deck" && deckAberto) renderizarCards();
  }, 300);
};

// ---------- Tela de erro ----------
function mostrarErro(titulo, detalhe) {
  const tela = document.createElement("div");
  tela.className = "tela-erro";
  tela.innerHTML =
    '<div class="erro-caixa">' +
    '<div class="erro-icone"><svg class="ico"><use href="#i-alerta"/></svg></div>' +
    "<h2></h2><p class=\"texto-suave\"></p>" +
    '<button class="btn principal" id="erro-tentar">Tentar de novo</button></div>';
  tela.querySelector("h2").textContent = titulo;
  tela.querySelector("p").textContent = detalhe;
  tela.querySelector("#erro-tentar").addEventListener("click", () => location.reload());
  document.body.appendChild(tela);
}
// ---------- Início ----------
async function iniciar() {
  aplicarTema(localStorage.getItem("tema") || "escuro");
  mostrarUltimoBackup();
  mostrarTela("decks");

  try {
    await abrirBanco();
  } catch (erro) {
    mostrarErro("Não consegui abrir seus dados", String(erro));
    return;
  }

  // Pede ao navegador para não apagar os dados automaticamente
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  renderizarDecks();
}

iniciar();

// ---------- Modo offline (service worker) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}
