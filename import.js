// import.js — Fase 2, Etapa 1: importar cartões de texto/CSV
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
      <p class="imp-ajuda">Uma linha por cartão, no formato <b>frente;verso</b> (ou separado por Tab, como o Anki exporta). Aceita **negrito** e &lt;br&gt; para quebra de linha.</p>

      <label for="imp-deck">Colocar no deck</label>
      <select id="imp-deck"></select>
      <input type="text" id="imp-novo-deck" placeholder="Nome do novo deck" hidden>

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

   function interpretar(texto) {
    texto = texto.replace(/^\uFEFF/, "");
    const primeira = texto.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "";
    const sep = primeira.includes("\t") ? "\t" : ";";

    // Cabeçalhos do Anki: quais colunas são especiais (tags, guid, tipo de nota...)
    const especiais = new Set();
    let colunaTags = -1;
    for (const m of texto.matchAll(/^#(\w+) column:(\d+)/gm)) {
      especiais.add(Number(m[2]) - 1);
      if (m[1] === "tags") colunaTags = Number(m[2]) - 1;
    }

    const cartoes = [];
    let ignoradas = 0;
    for (const campos of lerTabela(texto, sep)) {
      if (campos.length === 1 && campos[0].trim() === "") continue;       // linha vazia
      if (campos.length === 1 && campos[0].startsWith("#")) continue;     // cabeçalho do Anki
      if (campos.length < 2) { ignoradas++; continue; }

      let frente, verso, tags = [];
      if (sep === "\t") {
        // Com Tab: frente e verso são as duas primeiras colunas que não são especiais
        const idx = campos.map((_, i) => i).filter((i) => !especiais.has(i));
        if (idx.length < 2) { ignoradas++; continue; }
        frente = limparHtml(campos[idx[0]]);
        verso = limparHtml(campos[idx[1]]);
        if (colunaTags >= 0 && campos[colunaTags]) tags = lerTags(campos[colunaTags]);
      } else {
        // Com ";" tudo depois do primeiro ; é verso
        frente = limparHtml(campos[0]);
        verso = limparHtml(campos.slice(1).join(";"));
      }

      if (!frente || !verso) { ignoradas++; continue; }
      cartoes.push({ frente, verso, tags });
    }
    return { cartoes, ignoradas };
  }

  // ---------- Prévia ----------
  function atualizarPrevia() {
    const { cartoes, ignoradas } = interpretar(areaTexto.value);
    if (!areaTexto.value.trim()) { previa.textContent = ""; return; }

    let html = "<b>" + cartoes.length + (cartoes.length === 1 ? " cartão encontrado" : " cartões encontrados") + "</b>";
    if (ignoradas) html += " · " + ignoradas + (ignoradas === 1 ? " linha ignorada" : " linhas ignoradas");
    cartoes.slice(0, 3).forEach((c) => {
      const f = c.frente.replace(/\n/g, " ").slice(0, 60);
      const v = c.verso.replace(/\n/g, " ").slice(0, 60);
      html += '<div class="imp-ex">' + escaparHtml(f) + " → " + escaparHtml(v) + "</div>";
    });
    previa.innerHTML = html;
  }

  // ---------- Abrir / fechar ----------
  async function abrir() {
    const decks = await listarDecks();
    decks.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    selDeck.innerHTML = "";
    decks.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.nome;
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

    btnImportar.disabled = true; // evita toque duplo
    try {
      let deckId;
      let existentes = [];
      if (selDeck.value === "novo") {
        const nome = inpNovo.value.trim();
        if (!nome) { inpNovo.focus(); return; }
        deckId = await salvarDeck({ nome, criadoEm: Date.now() });
      } else {
        deckId = Number(selDeck.value);
        existentes = await listarCards(deckId);
      }

      // Pula cartões idênticos (mesma frente e mesmo verso) que já existem
      const chave = (f, v) => f + "\u0000" + v;
      const jaTem = new Set(existentes.map((c) => chave(c.frente.trim(), c.verso.trim())));
            const base = Date.now();
      const tagsLote = lerTags($("imp-tags").value);
      const novos = [];
      let repetidos = 0;
      cartoes.forEach((c) => {
        const k = chave(c.frente, c.verso);
        if (jaTem.has(k)) { repetidos++; return; }
        jaTem.add(k);
        novos.push({ deckId, frente: c.frente, verso: c.verso, criadoEm: base + novos.length });
      });

      await salvarVariosCards(novos);
      fechar();
      renderizarDecks();
      alert(
        novos.length + (novos.length === 1 ? " cartão importado." : " cartões importados.") +
        (repetidos ? "\n" + repetidos + " repetido(s) foram ignorados." : "")
      );
    } catch (erro) {
      alert("Não consegui importar: " + erro);
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
