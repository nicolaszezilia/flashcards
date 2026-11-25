// import.js — importar cartões de texto/CSV (com suporte a subdecks "A::B::C")
(function () {
  // ---------- Estilo (só desta janela) ----------
  const estilo = document.createElement("style");
  estilo.textContent = `
  .imp-fundo{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center}
  .imp-fundo.imp-aberto{display:flex}
  .imp-caixa{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;background:#1e1e22;color:#eee;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}
  @media (min-width:700px){.imp-fundo{align-items:center}.imp-caixa{border-radius:16px}}
  .imp-caixa h2{margin:0 0 8px;font-size:20px}
  .imp-ajuda{font-size:14px;opacity:.75;margin:0 0 12px;line-height:1.4}
  .imp-caixa label{display:block;font-size:14px;margin:12px 0 4px;opacity:.85}
  .imp-caixa select,.imp-caixa input[type=text],.imp-caixa textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:12px;border-radius:10px;border:1px solid #555;background:#2a2a30;color:inherit}
  .imp-caixa textarea{min-height:140px;resize:vertical}
  .imp-previa{margin:12px 0;font-size:14px;line-height:1.5}
  .imp-ex{opacity:.75;margin-top:4px}
  .imp-linha{display:flex;gap:10px;margin-top:12px}
  .imp-linha button{flex:1;min-height:48px;font-size:16px;font-family:inherit;border-radius:12px;border:1px solid #555;background:transparent;color:inherit}
  .imp-linha button.imp-principal{background:#4f8cff;border-color:#4f8cff;color:#fff;font-weight:600}
  .imp-linha button:disabled{opacity:.5}
  :root[data-tema="claro"] .imp-caixa{background:#fff;color:#111}
  :root[data-tema="claro"] .imp-caixa select,
  :root[data-tema="claro"] .imp-caixa input[type=text],
  :root[data-tema="claro"] .imp-caixa textarea{background:#f2f2f5;border-color:#ccc}
  :root[data-tema="claro"] .imp-linha button{border-color:#ccc}
  `;
  document.head.appendChild(estilo);

  // ---------- Janela ----------
  const fundo = document.createElement("div");
  fundo.className = "imp-fundo";
  fundo.innerHTML = `
    <div class="imp-caixa">
      <h2>Importar cartões</h2>
      <p class="imp-ajuda">Uma linha por cartão, no formato <b>frente;verso</b> (ou separado por Tab, como o Anki exporta). Aceita **negrito** e &lt;br&gt; para quebra de linha. Arquivos do Anki com coluna de deck (ex.: <b>Residência 2027::Cirurgia::CAD</b>) criam os subdecks sozinhos.</p>

      <label for="imp-deck">Colocar no deck (para cartões sem deck no arquivo)</label>
      <select id="imp-deck"></select>
      <input type="text" id="imp-novo-deck" placeholder="Nome do novo deck (use :: para subdecks)" hidden>

      <label for="imp-texto">Cole o texto aqui</label>
      <textarea id="imp-texto" placeholder="Pergunta;Resposta"></textarea>

      <div class="imp-linha">
        <button type="button" id="imp-escolher">📄 Escolher arquivo</button>
      </div>
      <input type="file" id="imp-arquivo" accept=".txt,.csv,.tsv,text/plain,text/csv" hidden>
      <label for="imp-tags">Tags para todos os cartões (opcional)</label>
      <input type="text" id="imp-tags" placeholder="ex.: cardio ecg" autocapitalize="none" autocomplete="off">

      <div class="imp-previa" id="imp-previa"></div>

      <div class="imp-linha">
        <button type="button" id="imp-cancelar">Cancelar</button>
        <button type="button" id="imp-importar" class="imp-principal">Importar</button>
      </div>
    </div>`;
  document.body.appendChild(fundo);

  const $ = (id) => document.getElementById(id);
  const selDeck = $("imp-deck");
  const inpNovo = $("imp-novo-deck");
  const areaTexto = $("imp-texto");
  const previa = $("imp-previa");
  const btnImportar = $("imp-importar");

  // ---------- Leitura do texto ----------
  // Lê linhas e colunas, respeitando "aspas" (campos com ; ou quebra de linha dentro)
  function lerTabela(texto, sep) {
    const linhas = [];
    let linha = [], campo = "", aspas = false, comAspas = false;
    const fimCampo = () => { linha.push(campo); campo = ""; comAspas = false; };
    const fimLinha = () => { fimCampo(); linhas.push(linha); linha = []; };

    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else aspas = false;
        } else campo += c;
      } else if (c === '"' && campo === "" && !comAspas) {
        aspas = true; comAspas = true;
      } else if (c === sep) fimCampo();
      else if (c === "\n") fimLinha();
      else if (c === "\r") { /* ignora */ }
      else campo += c;
    }
    if (campo !== "" || linha.length) fimLinha();
    return linhas;
  }

  // Converte o HTML simples do Anki para o nosso formato
  function limparHtml(t) {
    return t
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

  // "  Residência 2027 :: Cirurgia::CAD " vira "Residência 2027::Cirurgia::CAD"
  function limparNomeDeck(t) {
    return String(t || "")
      .split("::")
      .map((p) => p.trim())
      .filter(Boolean)
      .join("::");
  }

  function interpretar(texto) {
    texto = texto.replace(/^\uFEFF/, "");
    const primeira = texto.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "";
    const sep = primeira.includes("\t") ? "\t" : ";";

    // Cabeçalhos do Anki: quais colunas são especiais (tags, deck, guid, tipo de nota...)
    const especiais = new Set();
    let colunaTags = -1;
    let colunaDeck = -1;
    for (const m of texto.matchAll(/^#(\w+) column:(\d+)/gm)) {
      especiais.add(Number(m[2]) - 1);
      if (m[1] === "tags") colunaTags = Number(m[2]) - 1;
      if (m[1] === "deck") colunaDeck = Number(m[2]) - 1;
    }
    // "#deck:Nome" = um deck único para o arquivo inteiro
    const fixo = texto.match(/^#deck:(.+)$/m);
    const deckFixo = fixo ? limparNomeDeck(fixo[1]) : "";

    const cartoes = [];
    let ignoradas = 0;
    for (const campos of lerTabela(texto, sep)) {
      if (campos.length === 1 && campos[0].trim() === "") continue;       // linha vazia
      if (campos.length === 1 && campos[0].startsWith("#")) continue;     // cabeçalho do Anki
            if (campos.length < 2 && !temCloze(campos[0])) { ignoradas++; continue; }

      let frente, verso, tags = [], deck = deckFixo;
      if (sep === "\t") {
        // Com Tab: frente e verso são as duas primeiras colunas que não são especiais
        const idx = campos.map((_, i) => i).filter((i) => !especiais.has(i));
                if (idx.length < 1) { ignoradas++; continue; }
        frente = limparHtml(campos[idx[0]] || "");
        verso = idx.length > 1 ? limparHtml(campos[idx[1]] || "") : "";
        if (colunaTags >= 0 && campos[colunaTags]) tags = lerTags(campos[colunaTags]);
        if (colunaDeck >= 0 && campos[colunaDeck]) {
          const d = limparNomeDeck(campos[colunaDeck]);
          if (d) deck = d;
        }
      } else {
        // Com ";" tudo depois do primeiro ; é verso
        frente = limparHtml(campos[0]);
        verso = limparHtml(campos.slice(1).join(";"));
      }

            if (!frente || (!verso && !temCloze(frente))) { ignoradas++; continue; }
      cartoes.push({ frente, verso, tags, deck, tipo: temCloze(frente) ? "cloze" : "basico" });
    }
    return { cartoes, ignoradas };
  }

  // ---------- Prévia ----------
  function atualizarPrevia() {
    const { cartoes, ignoradas } = interpretar(areaTexto.value);
    if (!areaTexto.value.trim()) { previa.textContent = ""; return; }

    let html = "<b>" + cartoes.length + (cartoes.length === 1 ? " cartão encontrado" : " cartões encontrados") + "</b>";
    if (ignoradas) html += " · " + ignoradas + (ignoradas === 1 ? " linha ignorada" : " linhas ignoradas");

    const comDeck = cartoes.filter((c) => c.deck);
    if (comDeck.length) {
      const nomes = new Set(comDeck.map((c) => c.deck.toLowerCase()));
      html += "<div class=\"imp-ex\">" + comDeck.length + " cartão(ões) com deck indicado no arquivo, em " +
        nomes.size + " deck(s) (os níveis que faltarem serão criados).</div>";
      const semDeck = cartoes.length - comDeck.length;
      if (semDeck) html += "<div class=\"imp-ex\">" + semDeck + " sem deck: vão para o deck escolhido acima.</div>";
    }

    cartoes.slice(0, 3).forEach((c) => {
      const f = c.frente.replace(/\n/g, " ").slice(0, 60);
      const v = c.verso.replace(/\n/g, " ").slice(0, 60);
      html += '<div class="imp-ex">' + escaparHtml(f) + " → " + escaparHtml(v) +
        (c.deck ? " <i>(" + escaparHtml(c.deck) + ")</i>" : "") + "</div>";
    });
    previa.innerHTML = html;
  }

  // ---------- Abrir / fechar ----------
  async function abrir() {
    const decks = await listarDecks();
    const lista = decks
      .map((d) => ({ id: d.id, caminho: caminhoDoDeck(decks, d.id) }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"));

    selDeck.innerHTML = "";
    lista.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.caminho;
      selDeck.appendChild(o);
    });
    const novo = document.createElement("option");
    novo.value = "novo";
    novo.textContent = "➕ Novo deck…";
    selDeck.appendChild(novo);

    if (decks.length === 0) selDeck.value = "novo";
    else if (deckAberto && decks.some((d) => d.id === deckAberto.id)) selDeck.value = String(deckAberto.id);
    inpNovo.hidden = selDeck.value !== "novo";

    areaTexto.value = "";
    inpNovo.value = "";
    $("imp-tags").value = "";
    previa.textContent = "";
    fundo.classList.add("imp-aberto");
  }

  function fechar() {
    fundo.classList.remove("imp-aberto");
  }

  // ---------- Importar ----------
  async function importar() {
    const { cartoes } = interpretar(areaTexto.value);
    if (cartoes.length === 0) {
      alert("Não encontrei nenhum cartão. Use o formato: frente;verso (um por linha).");
      areaTexto.focus();
      return;
    }

    // O deck escolhido na janela só é necessário para cartões sem deck no arquivo
    const algumSemDeck = cartoes.some((c) => !c.deck);
    if (algumSemDeck && selDeck.value === "novo" && !inpNovo.value.trim()) {
      inpNovo.focus();
      return;
    }

    btnImportar.disabled = true; // evita toque duplo
    try {
      // Cria (se faltar) cada nível do caminho; guarda para não repetir a busca
      const cacheDecks = new Map();
      const idDoCaminho = async (caminho) => {
        const k = caminho.toLowerCase();
        if (!cacheDecks.has(k)) cacheDecks.set(k, await garantirCaminho(caminho));
        return cacheDecks.get(k);
      };

      let deckPadrao = null;
      if (algumSemDeck) {
        deckPadrao =
          selDeck.value === "novo"
            ? await idDoCaminho(limparNomeDeck(inpNovo.value))
            : Number(selDeck.value);
      }

      // Agrupa os cartões pelo deck de destino
      const grupos = new Map();
      for (const c of cartoes) {
        const id = c.deck ? await idDoCaminho(c.deck) : deckPadrao;
        if (!grupos.has(id)) grupos.set(id, []);
        grupos.get(id).push(c);
      }

      // Pula cartões idênticos (mesma frente e mesmo verso) que já existem no deck de destino
      const chave = (f, v) => f + "\u0000" + v;
      const base = Date.now();
      const tagsLote = lerTags($("imp-tags").value);
      const novos = [];
      let repetidos = 0;

      for (const [deckId, lista] of grupos) {
        const existentes = await listarCards(deckId);
        const jaTem = new Set(existentes.map((c) => chave(c.frente.trim(), c.verso.trim())));
        lista.forEach((c) => {
          const k = chave(c.frente, c.verso);
          if (jaTem.has(k)) { repetidos++; return; }
          jaTem.add(k);
          const tags = [...new Set([...c.tags, ...tagsLote])];
          novos.push({ deckId, frente: c.frente, verso: c.verso, tags, criadoEm: base + novos.length });
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
    } finally {
      btnImportar.disabled = false;
    }
  }

  // ---------- Ligações ----------
  areaTexto.addEventListener("input", atualizarPrevia);
  selDeck.addEventListener("change", () => {
    inpNovo.hidden = selDeck.value !== "novo";
    if (!inpNovo.hidden) inpNovo.focus();
  });
  $("imp-escolher").addEventListener("click", () => $("imp-arquivo").click());
  $("imp-arquivo").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    areaTexto.value = await arquivo.text();
    atualizarPrevia();
  });
  $("imp-cancelar").addEventListener("click", fechar);
  btnImportar.addEventListener("click", importar);
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });

  // Botão novo na aba Ajustes, logo abaixo do "Importar" do backup
  const botaoBackup = document.getElementById("btn-importar");
  const botao = document.createElement("button");
  botao.id = "btn-importar-texto";
  botao.className = botaoBackup.className;
  botao.textContent = "Importar cartões (texto/CSV)";
  botao.addEventListener("click", abrir);
  botaoBackup.after(botao);
})();
