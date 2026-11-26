// apkg.js — importar arquivos .apkg do Anki (com subdecks, tags e cloze)
(function () {
  const URL_ZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const BASE_SQL = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/";
  const DECK_PADRAO = "Importados do Anki";

  // ---------- Janela (usa o estilo criado pelo import.js) ----------
  const fundo = document.createElement("div");
  fundo.className = "imp-fundo";
  fundo.innerHTML = `
    <div class="imp-caixa">
      <h2>Importar arquivo .apkg</h2>
      <p class="imp-ajuda">Importa decks do Anki mantendo subdecks, tags, negrito e cloze. Os cartões entram como <b>novos</b> (o histórico de estudo do Anki não é levado) e imagens são reduzidas e guardadas dentro do cartão (áudio é ignorado). No Anki, exporte com <b>"Compatível com versões antigas"</b> marcado.</p>

      <div class="imp-linha">
        <button type="button" id="apkg-escolher">📦 Escolher arquivo .apkg</button>
      </div>
      <input type="file" id="apkg-arquivo" hidden>

      <div class="imp-previa" id="apkg-previa"></div>

      <div class="imp-linha">
        <button type="button" id="apkg-cancelar">Cancelar</button>
        <button type="button" id="apkg-importar" class="imp-principal" disabled>Importar</button>
      </div>
    </div>`;
  document.body.appendChild(fundo);

  const $ = (id) => document.getElementById(id);
  const previa = $("apkg-previa");
  const btnImportar = $("apkg-importar");
  let lido = null; // resultado da leitura do arquivo

  // ---------- Bibliotecas (baixadas só na primeira vez) ----------
  function carregarScript(url) {
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = url;
      s.crossOrigin = "anonymous";
      s.onload = ok;
      s.onerror = () =>
        falha(new Error("Não consegui baixar uma biblioteca necessária. Conecte-se à internet (só é preciso na primeira vez)."));
      document.head.appendChild(s);
    });
  }

  let SQLpronto = null;
  async function prepararBibliotecas() {
    if (!window.JSZip) await carregarScript(URL_ZIP);
    if (!SQLpronto) {
      if (!window.initSqlJs) await carregarScript(BASE_SQL + "sql-wasm.js");
      SQLpronto = await window.initSqlJs({ locateFile: (f) => BASE_SQL + f });
    }
    return SQLpronto;
  }

  // ---------- Limpeza de texto ----------
  function limparHtml(t) {
    return String(t || "")
      .replace(/\[sound:[^\]]*\]/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li)>/gi, "\n")
      .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function limparNomeDeck(t) {
    return String(t || "")
      .replace(/\x1f/g, "::")
      .split("::")
      .map((p) => p.trim())
      .filter(Boolean)
      .join("::");
  }

  // ---------- Leitura do .apkg ----------
  async function lerApkg(arquivo) {
    const SQL = await prepararBibliotecas();
    let zip;
    try {
      zip = await JSZip.loadAsync(arquivo);
    } catch (e) {
      throw new Error("Este arquivo não é um .apkg válido.");
    }

    let nome = null;
    if (zip.file("collection.anki21")) nome = "collection.anki21";
    else if (zip.file("collection.anki21b")) {
      throw new Error('Este .apkg está no formato novo do Anki. Exporte de novo marcando "Compatível com versões antigas do Anki".');
    } else if (zip.file("collection.anki2")) nome = "collection.anki2";
    else throw new Error("Não encontrei os cartões dentro do arquivo.");

    const bytes = await zip.file(nome).async("uint8array");
    const db = new SQL.Database(bytes);
    try {
      const col = db.exec("SELECT models, decks FROM col")[0].values[0];
      const modelos = JSON.parse(col[0]);
      const decks = JSON.parse(col[1]);

      // Deck de cada nota = deck do primeiro cartão dela
      const deckDaNota = new Map();
      const rc = db.exec(
        "SELECT nid, CASE WHEN odid != 0 THEN odid ELSE did END FROM cards ORDER BY ord, id"
      );
      if (rc.length) {
        for (const [nid, did] of rc[0].values) {
          if (!deckDaNota.has(nid)) deckDaNota.set(nid, did);
        }
      }

      const cartoes = [];
      let ignoradas = 0;
      let comImagem = 0;
      const rn = db.exec("SELECT id, mid, flds, tags FROM notes");
      if (rn.length) {
        for (const [id, mid, flds, tagsTxt] of rn[0].values) {
          const campos = String(flds).split("\x1f");
          if (/<img/i.test(flds)) comImagem++;

          const frente = limparHtml(campos[0]);
          const verso = limparHtml(campos[1] || "");
          const cloze = temCloze(frente);
          if (!frente || (!cloze && !verso)) { ignoradas++; continue; }

          const did = deckDaNota.get(id);
          let deck = limparNomeDeck(decks[String(did)] && decks[String(did)].name);
          if (!deck || /^(default|padrão|padrao)$/i.test(deck)) deck = DECK_PADRAO;

          cartoes.push({
            frente, verso, deck,
            tags: lerTags(String(tagsTxt || "")),
            tipo: cloze ? "cloze" : "basico",
          });
        }
      }
      return { cartoes, ignoradas, comImagem };
    } finally {
      db.close();
    }
  }

  // ---------- Prévia ----------
  function mostrarPrevia() {
    const { cartoes, ignoradas, comImagem } = lido;
    const nomes = new Set(cartoes.map((c) => c.deck.toLowerCase()));
    let html =
      "<b>" + cartoes.length + (cartoes.length === 1 ? " cartão encontrado" : " cartões encontrados") +
      "</b> em " + nomes.size + (nomes.size === 1 ? " deck" : " decks");
    if (ignoradas) html += '<div class="imp-ex">' + ignoradas + " nota(s) vazia(s) ignorada(s).</div>";
    if (comImagem) html += '<div class="imp-ex">' + comImagem + " nota(s) têm imagem; as imagens não serão importadas.</div>";
    cartoes.slice(0, 3).forEach((c) => {
      const f = c.frente.replace(/\n/g, " ").slice(0, 60);
      const v = c.verso.replace(/\n/g, " ").slice(0, 60);
      html += '<div class="imp-ex">' + escaparHtml(f) + " → " + escaparHtml(v) +
        " <i>(" + escaparHtml(c.deck) + ")</i></div>";
    });
    previa.innerHTML = html;
  }

  // ---------- Importar ----------
  async function importar() {
    if (!lido || lido.cartoes.length === 0) return;
    btnImportar.disabled = true; // evita toque duplo
    previa.textContent = "Importando…";
    try {
      const cacheDecks = new Map();
      const idDoCaminho = async (caminho) => {
        const k = caminho.toLowerCase();
        if (!cacheDecks.has(k)) cacheDecks.set(k, await garantirCaminho(caminho));
        return cacheDecks.get(k);
      };

      const grupos = new Map();
      for (const c of lido.cartoes) {
        const id = await idDoCaminho(c.deck);
        if (!grupos.has(id)) grupos.set(id, []);
        grupos.get(id).push(c);
      }

      // Pula cartões idênticos que já existem no deck de destino
      const chave = (f, v) => f + "\u0000" + v;
      const base = Date.now();
      const novos = [];
      let repetidos = 0;
      for (const [deckId, lista] of grupos) {
        const existentes = await listarCards(deckId);
        const jaTem = new Set(existentes.map((c) => chave(c.frente.trim(), c.verso.trim())));
        lista.forEach((c) => {
          const k = chave(c.frente, c.verso);
          if (jaTem.has(k)) { repetidos++; return; }
          jaTem.add(k);
          novos.push({
            deckId, frente: c.frente, verso: c.verso, tags: c.tags,
            tipo: c.tipo, criadoEm: base + novos.length,
          });
        });
      }

      await salvarVariosCards(novos);
      fechar();
      renderizarDecks();
      alert(
        novos.length + (novos.length === 1 ? " cartão importado" : " cartões importados") +
        " em " + grupos.size + (grupos.size === 1 ? " deck." : " decks.") +
        (repetidos ? "\n" + repetidos + " repetido(s) foram ignorados." : "")
      );
    } catch (erro) {
      alert("Não consegui importar: " + (erro.message || erro));
      mostrarPrevia();
      btnImportar.disabled = false;
    }
  }

  // ---------- Abrir / fechar ----------
  function abrir() {
    lido = null;
    previa.textContent = "";
    btnImportar.disabled = true;
    fundo.classList.add("imp-aberto");
  }
  function fechar() {
    fundo.classList.remove("imp-aberto");
  }

  // ---------- Ligações ----------
  $("apkg-escolher").addEventListener("click", () => $("apkg-arquivo").click());
  $("apkg-arquivo").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    lido = null;
    btnImportar.disabled = true;
    previa.textContent = "Lendo o arquivo… (na primeira vez pode demorar um pouco)";
    try {
      lido = await lerApkg(arquivo);
      if (lido.cartoes.length === 0) {
        previa.textContent = "Não encontrei nenhum cartão utilizável neste arquivo.";
        return;
      }
      mostrarPrevia();
      btnImportar.disabled = false;
    } catch (erro) {
      previa.textContent = erro.message || String(erro);
    }
  });
  $("apkg-cancelar").addEventListener("click", fechar);
  btnImportar.addEventListener("click", importar);
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });

  // Botão novo em Ajustes, logo abaixo do "Importar cartões (texto/CSV)"
  const ancora = document.getElementById("btn-importar-texto") || document.getElementById("btn-importar");
  const botao = document.createElement("button");
  botao.id = "btn-importar-apkg";
  botao.className = ancora.className;
  botao.textContent = "Importar arquivo .apkg (Anki)";
  botao.addEventListener("click", abrir);
  ancora.after(botao);
})();
