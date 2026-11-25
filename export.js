// export.js — exportar um deck (e seus subdecks) para o Anki
(function () {
    // Nomes dos tipos de nota no SEU Anki (confira em Ferramentas → Gerenciar tipos de nota)
  const NOTA_BASICA = "Basic";
  const NOTA_CLOZE = "Cloze";
  // ---------- Janela (usa o estilo criado pelo import.js) ----------
  const fundo = document.createElement("div");
  fundo.className = "imp-fundo";
  fundo.innerHTML = `
    <div class="imp-caixa">
      <h2>Exportar para o Anki</h2>
      <p class="imp-ajuda">Gera um arquivo de texto que o Anki importa direto (Arquivo → Importar). Os subdecks vão junto e a hierarquia é mantida (Deck::Subdeck). Negrito e quebras de linha também são mantidos.</p>

      <label for="exp-deck">Deck (inclui os subdecks)</label>
      <select id="exp-deck"></select>
      <div class="imp-previa" id="exp-info"></div>

      <div class="imp-linha">
        <button type="button" id="exp-cancelar">Cancelar</button>
        <button type="button" id="exp-exportar" class="imp-principal">Exportar</button>
      </div>
    </div>`;
  document.body.appendChild(fundo);

  const $ = (id) => document.getElementById(id);
  const selDeck = $("exp-deck");
  const info = $("exp-info");
  const btnExportar = $("exp-exportar");
  let decks = [];

  // ---------- Conversão de um campo ----------
  // Usa o mesmo formatador da tela (negrito e quebra de linha),
  // troca Tab por espaço e protege as aspas
  function campoAnki(texto) {
    const html = formatarTexto(texto).replace(/\t/g, " ");
    return '"' + html.replace(/"/g, '""') + '"';
  }

  // Caminho do deck na coluna 4 (sem Tab nem quebra de linha, entre aspas)
  function campoDeck(caminho) {
    const limpo = caminho.replace(/[\t\r\n]+/g, " ");
    return '"' + limpo.replace(/"/g, '""') + '"';
  }

  // ---------- Abrir / fechar ----------
  async function atualizarInfo() {
    const id = Number(selDeck.value);
    const ids = idsDaSubarvore(decks, id);
    let qtd = 0;
    for (const x of ids) qtd += await contarCards(x);
    info.textContent =
      qtd + (qtd === 1 ? " cartão" : " cartões") + " em " + ids.length +
      (ids.length === 1 ? " deck" : " decks") + (qtd === 1 ? " será exportado" : " serão exportados");
    btnExportar.disabled = qtd === 0;
  }

  async function abrir() {
    decks = await listarDecks();
    if (decks.length === 0) {
      alert("Você ainda não tem nenhum deck para exportar.");
      return;
    }

    selDeck.innerHTML = "";
    decks
      .map((d) => ({ id: d.id, caminho: caminhoDoDeck(decks, d.id) }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"))
      .forEach((d) => {
        const o = document.createElement("option");
        o.value = d.id;
        o.textContent = d.caminho;
        selDeck.appendChild(o);
      });
    if (deckAberto && decks.some((d) => d.id === deckAberto.id)) {
      selDeck.value = String(deckAberto.id);
    }

    await atualizarInfo();
    fundo.classList.add("imp-aberto");
  }

  function fechar() {
    fundo.classList.remove("imp-aberto");
  }

  // ---------- Exportar ----------
  async function exportar() {
    const deck = decks.find((d) => d.id === Number(selDeck.value));
    if (!deck) return;

    btnExportar.disabled = true; // evita toque duplo
    try {
      const ids = idsDaSubarvore(decks, deck.id);
      const linhas = ["#separator:tab", "#html:true", "#tags column:3", "#deck column:4"];

      for (const id of ids) {
        const cards = await listarCards(id);
        cards.sort((a, b) => a.criadoEm - b.criadoEm);
        const caminho = campoDeck(caminhoDoDeck(decks, id));
        cards.forEach((c) => {
          const tags = (c.tags || []).join(" ");
          linhas.push(campoAnki(c.frente) + "\t" + campoAnki(c.verso) + "\t" + tags + "\t" + caminho);
        });
      }

      const nomeSeguro = deck.nome.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "deck";
      const nomeArquivo = "anki-" + nomeSeguro + "-" + dataLocal() + ".txt";
      const arquivo = new File([linhas.join("\n") + "\n"], nomeArquivo, { type: "text/plain" });

      // No celular, abre a folha de compartilhar; no PC, baixa direto
      const ehToque = window.matchMedia("(pointer: coarse)").matches;
      let compartilhou = false;
      if (ehToque && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: deck.nome });
          compartilhou = true;
        } catch (erro) {
          if (erro.name === "AbortError") return; // você cancelou
        }
      }
      if (!compartilhou) baixarArquivo(arquivo);
      fechar();
    } catch (erro) {
      alert("Não consegui exportar: " + erro);
    } finally {
      btnExportar.disabled = false;
    }
  }

  // ---------- Ligações ----------
  selDeck.addEventListener("change", atualizarInfo);
  $("exp-cancelar").addEventListener("click", fechar);
  btnExportar.addEventListener("click", exportar);
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });

  // Botão novo na aba Ajustes, logo abaixo do "Importar cartões"
  const ancora = document.getElementById("btn-importar-texto") || document.getElementById("btn-importar");
  const botao = document.createElement("button");
  botao.id = "btn-exportar-anki";
  botao.className = ancora.className;
  botao.textContent = "Exportar deck para o Anki";
  botao.addEventListener("click", abrir);
  ancora.after(botao);
})();
