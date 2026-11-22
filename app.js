const titulos = {
  decks: "Meus decks",
  estudo: "Estudar",
  ajustes: "Ajustes",
};

let deckEmEdicao = null;  // null = criando um deck novo
let deckAberto = null;    // deck cujos cartões estão na tela
let cardEmEdicao = null;  // null = criando um cartão novo
let campoAtivo = null;    // campo de texto onde o botão Negrito atua

// ---------- Texto formatado ----------
function escaparHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// **negrito** vira <strong>, e quebra de linha vira <br>
function formatarTexto(t) {
  return escaparHtml(t)
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}
// ---------- Cloze (lacunas) ----------
// Formato: {{c1::resposta}} ou {{c1::resposta::dica}}
const REGEX_CLOZE = /\{\{c\d+::(.+?)(?:::(.+?))?\}\}/gs;

const ehCloze = (card) => card.tipo === "cloze";

function temCloze(t) {
  return /\{\{c\d+::.+?\}\}/s.test(t);
}

// revelar = false: mostra [...] ; revelar = true: mostra a resposta em destaque
function formatarCloze(t, revelar) {
  const html = escaparHtml(t).replace(REGEX_CLOZE, (_, resp, dica) =>
    revelar
      ? '<span class="lacuna-resp">' + resp + "</span>"
      : '<span class="lacuna">[' + (dica || "...") + "]</span>"
  );
  return html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
// "Novos 5 · Aprender 1 · Revisar 12" com cores
function htmlContadores(c) {
  return (
    'Novos <b class="c-novo">' + c.novos + "</b> · " +
    'Aprender <b class="c-aprender">' + c.aprender + "</b> · " +
    'Revisar <b class="c-revisar">' + c.revisar + "</b>"
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
    .setAttribute("content", tema === "claro" ? "#f5f5f7" : "#121212");
}

document.querySelectorAll(".botao-tema").forEach((b) => {
  b.addEventListener("click", () => aplicarTema(b.dataset.tema));
});

// ---------- Lista de decks ----------
async function renderizarDecks() {
  const decks = await listarDecks();
  decks.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const lista = document.getElementById("lista-decks");
  lista.innerHTML = "";
    const feitosMapa = await feitosHojePorDeck();
  document.getElementById("vazio-decks").classList.toggle("oculto", decks.length > 0);

  for (const deck of decks) {
    const cardsDoDeck = await listarCards(deck.id);
    const qtd = cardsDoDeck.length;
    const pend = contarPendentes(cardsDoDeck, feitosDoDeck(feitosMapa, deck.id));

    const item = document.createElement("div");
    item.className = "deck-item";

    const info = document.createElement("div");
    info.className = "deck-info";
    const nome = document.createElement("span");
    nome.className = "deck-nome";
    nome.textContent = deck.nome;
    const contador = document.createElement("span");
    contador.className = "deck-qtd";
    contador.textContent = qtd + (qtd === 1 ? " cartão" : " cartões");
    const pendentes = document.createElement("span");
    pendentes.className = "deck-qtd";
    pendentes.innerHTML = htmlContadores(pend);
    info.append(nome, contador, pendentes);
    info.addEventListener("click", () => abrirDeck(deck));

    const btnEditar = document.createElement("button");
    btnEditar.className = "deck-editar";
    btnEditar.textContent = "✏️";
    btnEditar.setAttribute("aria-label", "Editar deck");
    btnEditar.addEventListener("click", () => abrirModal(deck));

    item.append(info, btnEditar);
    lista.appendChild(item);
  }
}

// ---------- Janela de criar / editar deck ----------
function abrirModal(deck = null) {
  deckEmEdicao = deck;
  document.getElementById("modal-titulo").textContent = deck ? "Editar deck" : "Novo deck";
  document.getElementById("input-nome").value = deck ? deck.nome : "";
  document.getElementById("btn-apagar").classList.toggle("oculto", !deck);
  document.getElementById("modal").classList.remove("oculto");
  document.getElementById("input-nome").focus();
}

function fecharModal() {
  document.getElementById("modal").classList.add("oculto");
  deckEmEdicao = null;
}

async function salvarModal() {
  const input = document.getElementById("input-nome");
  const nome = input.value.trim();
  if (!nome) {
    input.focus();
    return;
  }

  if (deckEmEdicao) {
    await salvarDeck({ ...deckEmEdicao, nome });
  } else {
    await salvarDeck({ nome, criadoEm: Date.now() });
  }

  fecharModal();
  renderizarDecks();
}

async function apagarModal() {
  if (!confirm('Apagar o deck "' + deckEmEdicao.nome + '" e todos os seus cartões?')) return;
  await apagarDeck(deckEmEdicao.id);
  fecharModal();
  renderizarDecks();
}

document.getElementById("btn-novo-deck").addEventListener("click", () => abrirModal());
document.getElementById("btn-salvar").addEventListener("click", salvarModal);
document.getElementById("btn-apagar").addEventListener("click", apagarModal);
document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
document.getElementById("input-nome").addEventListener("keydown", (e) => {
  if (e.key === "Enter") salvarModal();
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

    const feitosMapa = await feitosHojePorDeck();
  document.getElementById("deck-contadores").innerHTML =
    htmlContadores(contarPendentes(cards, feitosDoDeck(feitosMapa, deckAberto.id)));

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
    frente.innerHTML = formatarTexto(card.frente);

    const verso = document.createElement("div");
    verso.className = "card-verso";
    verso.innerHTML = formatarTexto(card.verso);

    item.append(frente, verso);

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
// ---------- Janela de criar / editar cartão ----------
function abrirModalCard(card = null) {
  cardEmEdicao = card;
  document.getElementById("modal-card-titulo").textContent = card ? "Editar cartão" : "Novo cartão";
  document.getElementById("input-frente").value = card ? card.frente : "";
  document.getElementById("input-verso").value = card ? card.verso : "";
    inputTags.value = card && card.tags ? card.tags.join(" ") : "";
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

  if (!frente) {
    campoFrente.focus();
    return;
  }
  if (!verso) {
    campoVerso.focus();
    return;
  }

   const tags = lerTags(inputTags.value);
  if (cardEmEdicao) {
    await salvarCard({ ...cardEmEdicao, frente, verso, tags });
  } else {
    await salvarCard({ deckId: deckAberto.id, frente, verso, tags, criadoEm: Date.now() });
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

// ---------- Aba Estudar (decks com contadores) ----------
async function renderizarEstudo() {
  const decks = await listarDecks();
  decks.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const lista = document.getElementById("lista-estudo");
  lista.innerHTML = "";
  document.getElementById("estudo-nada").classList.toggle("oculto", decks.length > 0);

  let totalHoje = 0;
  const feitosMapa = await feitosHojePorDeck();
    const todasTags = new Set();

  for (const deck of decks) {
        const cards = await listarCards(deck.id);
    cards.forEach((x) => (x.tags || []).forEach((t) => todasTags.add(t)));
    const c = contarPendentes(cards, feitosDoDeck(feitosMapa, deck.id), Date.now(), filtroEstudo);
    const total = c.novos + c.aprender + c.revisar;
    totalHoje += total;

    const item = document.createElement("div");
    item.className = "deck-item";

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

    item.append(info, btn);
    lista.appendChild(item);
  }
  popularFiltro(todasTags);
  const resumo = document.getElementById("resumo-hoje");
  if (decks.length === 0) {
    resumo.textContent = "";
    } else if (totalHoje === 0) {
    resumo.textContent =
      filtroEstudo.tipo === "todos"
        ? "Tudo em dia por hoje 🎉"
        : "Nada pendente hoje neste filtro.";
  } else {
    resumo.textContent = totalHoje + (totalHoje === 1 ? " cartão" : " cartões") + " para estudar hoje";
  }
}

// ---------- Estudo ----------
let sessao = null; // { fila, respondidos, revelado, origem }

async function iniciarEstudo(deck, origem, filtro = null) {
  if (deck) deckAberto = deck;
  const cards = await listarCards(deckAberto.id);

  if (cards.length === 0) {
    alert("Este deck ainda não tem cartões. Crie alguns primeiro.");
    return;
  }

    const feitosMapa = await feitosHojePorDeck();
    const fila = montarFila(cards, feitosDoDeck(feitosMapa, deckAberto.id), Date.now(), filtro);
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
  document.getElementById("estudo-frente").innerHTML = formatarTexto(card.frente);
  document.getElementById("estudo-verso").innerHTML = formatarTexto(card.verso);
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
  document.getElementById("estudo-verso").classList.remove("oculto");
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

document.getElementById("btn-estudar").addEventListener("click", () => iniciarEstudo(null, "deck"));
document.getElementById("estudo-card").addEventListener("click", revelarResposta);
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
// ---------- Início ----------
async function iniciar() {
  aplicarTema(localStorage.getItem("tema") || "escuro");
  mostrarUltimoBackup();
  mostrarTela("decks");

  try {
    await abrirBanco();
  } catch (erro) {
    alert("Não consegui abrir o banco de dados: " + erro);
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
