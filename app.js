const titulos = {
  decks: "Meus decks",
  estudo: "Estudar",
  ajustes: "Ajustes",
};

let deckEmEdicao = null; // null = criando um deck novo

// ---------- Navegação entre telas ----------
function mostrarTela(nome) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById("tela-" + nome).classList.add("ativa");

  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.tela === nome);
  });

  document.getElementById("titulo").textContent = titulos[nome];
}

document.querySelectorAll("nav button").forEach((b) => {
  b.addEventListener("click", () => mostrarTela(b.dataset.tela));
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

// ---------- Decks ----------
async function renderizarDecks() {
  const decks = await listarDecks();
  decks.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const lista = document.getElementById("lista-decks");
  lista.innerHTML = "";
  document.getElementById("vazio-decks").classList.toggle("oculto", decks.length > 0);

  decks.forEach((deck) => {
    const item = document.createElement("div");
    item.className = "deck-item";

    const nome = document.createElement("span");
    nome.className = "deck-nome";
    nome.textContent = deck.nome;

    const btnEditar = document.createElement("button");
    btnEditar.className = "deck-editar";
    btnEditar.textContent = "✏️";
    btnEditar.setAttribute("aria-label", "Editar deck");
    btnEditar.addEventListener("click", () => abrirModal(deck));

    item.append(nome, btnEditar);
    lista.appendChild(item);
  });
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
