const titulos = {
  decks: "Meus decks",
  estudo: "Estudar",
  ajustes: "Ajustes",
};

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

// ---------- Início ----------
aplicarTema(localStorage.getItem("tema") || "escuro");
mostrarTela("decks");
