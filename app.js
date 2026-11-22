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
  document.getElementById("vazio-decks").classList.toggle("oculto", decks.length > 0);

  for (const deck of decks) {
    const qtd = await contarCards(deck.id);

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
    info.append(nome, contador);
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

// ---------- Tela de um deck (lista de cartões) ----------
function abrirDeck(deck) {
  deckAberto = deck;
  mostrarTela("deck");
  renderizarCards();
}

async function renderizarCards() {
  const cards = await listarCards(deckAberto.id);
  cards.sort((a, b) => a.criadoEm - b.criadoEm);

  const lista = document.getElementById("lista-cards");
  lista.innerHTML = "";
  document.getElementById("vazio-cards").classList.toggle("oculto", cards.length > 0);

  cards.forEach((card) => {
    const item = document.createElement("div");
    item.className = "card-item";

    const frente = document.createElement("div");
    frente.className = "card-frente";
    frente.innerHTML = formatarTexto(card.frente);

    const verso = document.createElement("div");
    verso.className = "card-verso";
    verso.innerHTML = formatarTexto(card.verso);

    item.append(frente, verso);
    item.addEventListener("click", () => abrirModalCard(card));
    lista.appendChild(item);
  });
}

document.getElementById("btn-voltar").addEventListener("click", () => {
  mostrarTela("decks");
  renderizarDecks();
});

// ---------- Janela de criar / editar cartão ----------
function abrirModalCard(card = null) {
  cardEmEdicao = card;
  document.getElementById("modal-card-titulo").textContent = card ? "Editar cartão" : "Novo cartão";
  document.getElementById("input-frente").value = card ? card.frente : "";
  document.getElementById("input-verso").value = card ? card.verso : "";
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

  if (cardEmEdicao) {
    await salvarCard({ ...cardEmEdicao, frente, verso });
  } else {
    await salvarCard({ deckId: deckAberto.id, frente, verso, criadoEm: Date.now() });
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

// ---------- Estudo ----------
let sessao = null; // { fila, respondidos, revelado }

async function iniciarEstudo() {
  const cards = await listarCards(deckAberto.id);

  if (cards.length === 0) {
    alert("Este deck ainda não tem cartões. Crie alguns primeiro.");
    return;
  }

  const fila = montarFila(cards);
  if (fila.length === 0) {
    alert("Nada para estudar neste deck agora. 🎉");
    return;
  }

  sessao = { fila, respondidos: 0, revelado: false };
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
  sessao = null;
  document.body.classList.remove("estudando");
  document.getElementById("estudo-sessao").classList.add("oculto");
  document.getElementById("estudo-acoes").classList.add("oculto");
  document.getElementById("estudo-fim").classList.add("oculto");
  document.getElementById("estudo-vazio").classList.remove("oculto");
  mostrarTela("deck");
  renderizarCards();
}

document.getElementById("btn-estudar").addEventListener("click", iniciarEstudo);
document.getElementById("estudo-card").addEventListener("click", revelarResposta);
document.getElementById("btn-mostrar").addEventListener("click", revelarResposta);
document.getElementById("btn-sair-estudo").addEventListener("click", sairDoEstudo);
document.getElementById("btn-fim-estudo").addEventListener("click", sairDoEstudo);
document.querySelectorAll(".nota").forEach((b) => {
  b.addEventListener("click", () => responder(Number(b.dataset.nota)));
});
// ---------- Início ----------
async function iniciar() {
  aplicarTema(localStorage.getItem("tema") || "escuro");
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
