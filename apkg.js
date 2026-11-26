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
  // ---------- Imagens ----------
  const MAX_LADO = 800;            // maior lado da imagem, em pixels
  const LIMITE_POR_CARD = 800000;  // soma das imagens de um cartão (o Firebase aceita ~1 MB por cartão)
  const TIPOS = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
  };

  // Troca cada <img src="x"> por uma marca temporária com o nome do arquivo
  function marcarImagens(html) {
    return String(html || "").replace(
      /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi,
      (_, a, b, c) => "\uE000" + (a || b || c || "") + "\uE001"
    );
  }

  // Acha o nome certo no mapa de mídia (o texto pode ter %20, &amp; etc.)
  function descobrirNome(src, mapa) {
    const bruto = src.replace(/&amp;/g, "&");
    if (mapa.has(bruto)) return bruto;
    try {
      const d = decodeURIComponent(bruto);
      if (mapa.has(d)) return d;
    } catch (e) {}
    return null;
  }

  // Reduz a imagem e devolve um texto "data:image/jpeg;base64,..."
  async function comprimirImagem(bytes, mime) {
    let bmp;
    try {
      bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
    } catch (e) {
      return null;
    }
    const esc = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * esc));
    c.height = Math.max(1, Math.round(bmp.height * esc));
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; // fundo branco (PNG transparente viraria preto em JPEG)
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    let url = c.toDataURL("image/jpeg", 0.75);
    if (url.length > 300000) url = c.toDataURL("image/jpeg", 0.5);
    return url;
  }

  // Troca as marcas temporárias por [img:1], [img:2]... e junta as imagens na lista
  async function resolverImagens(texto, carregar, ctx, imagens) {
    const partes = texto.split(/\uE000([^\uE001]*)\uE001/);
    let saida = "";
    for (let i = 0; i < partes.length; i++) {
      if (i % 2 === 0) { saida += partes[i]; continue; }
      ctx.total++;
      const url = await carregar(partes[i]);
      const soma = imagens.reduce((s, u) => s + u.length, 0);
      if (url && soma + url.length <= LIMITE_POR_CARD) {
        let n = imagens.indexOf(url);
        if (n < 0) { imagens.push(url); n = imagens.length - 1; }
        saida += "[img:" + (n + 1) + "]";
      } else {
        ctx.falhas++;
      }
    }
    return saida.trim();
  }

  // Identifica as imagens de um cartão (para não tratar cartões diferentes como repetidos)
  function assinatura(imgs) {
    return (imgs || []).map((u) => {
      let h = 0;
      for (let i = 0; i < u.length; i += 97) h = (h * 31 + u.charCodeAt(i)) | 0;
      return u.length + ":" + h;
    }).join("|");
  }
  // ---------- Leitura do .apkg ----------
   async function lerApkg(arquivo, aoProgresso) {
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

    // Mapa das imagens: nome do arquivo -> nome dentro do zip ("0", "1"...)
    const mapaMidia = new Map();
    const arqMidia = zip.file("media");
    if (arqMidia) {
      try {
        const obj = JSON.parse(await arqMidia.async("string"));
        for (const [k, v] of Object.entries(obj)) mapaMidia.set(v, k);
      } catch (e) {}
    }
    const cache = new Map(); // a mesma imagem usada em vários cartões é lida uma vez
    const ctx = { total: 0, falhas: 0, feitas: 0 };
    const carregar = async (src) => {
      const nomeImg = descobrirNome(src, mapaMidia);
      if (!nomeImg) return null;
      if (cache.has(nomeImg)) return cache.get(nomeImg);
      let url = null;
      const ext = nomeImg.split(".").pop().toLowerCase();
      if (TIPOS[ext]) {
        const bytes = await zip.file(mapaMidia.get(nomeImg)).async("uint8array");
        url = await comprimirImagem(bytes, TIPOS[ext]);
      }
      cache.set(nomeImg, url);
      ctx.feitas++;
      if (aoProgresso && ctx.feitas % 10 === 0) aoProgresso("Processando imagens… " + ctx.feitas);
      return url;
    };

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
      const rn = db.exec("SELECT id, mid, flds, tags FROM notes");
      if (rn.length) {
        for (const [id, mid, flds, tagsTxt] of rn[0].values) {
          const campos = String(flds).split("\x1f");

          const imagens = [];
          let frente = limparHtml(marcarImagens(campos[0]));
          let verso = limparHtml(marcarImagens(campos[1] || ""));
          frente = await resolverImagens(frente, carregar, ctx, imagens);
          verso = await resolverImagens(verso, carregar, ctx, imagens);

          const cloze = temCloze(frente);
          if (!frente || (!cloze && !verso)) { ignoradas++; continue; }

          const did = deckDaNota.get(id);
          let deck = limparNomeDeck(decks[String(did)] && decks[String(did)].name);
          if (!deck || /^(default|padrão|padrao)$/i.test(deck)) deck = DECK_PADRAO;

          cartoes.push({
            frente, verso, deck, imagens,
            tags: lerTags(String(tagsTxt || "")),
            tipo: cloze ? "cloze" : "basico",
          });
        }
      }
      return { cartoes, ignoradas, imagens: ctx.total - ctx.falhas, falhas: ctx.falhas };
    } finally {
      db.close();
    }
  }

  // ---------- Prévia ----------
  function mostrarPrevia() {
        const { cartoes, ignoradas, imagens, falhas } = lido;
    const nomes = new Set(cartoes.map((c) => c.deck.toLowerCase()));
    let html =
      "<b>" + cartoes.length + (cartoes.length === 1 ? " cartão encontrado" : " cartões encontrados") +
      "</b> em " + nomes.size + (nomes.size === 1 ? " deck" : " decks");
    if (ignoradas) html += '<div class="imp-ex">' + ignoradas + " nota(s) vazia(s) ignorada(s).</div>";
        if (imagens) html += '<div class="imp-ex">' + imagens + (imagens === 1 ? " imagem será importada." : " imagens serão importadas.") + "</div>";
    if (falhas) html += '<div class="imp-ex">' + falhas + " imagem(ns) não puderam ser lidas e ficarão de fora.</div>";
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
