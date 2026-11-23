const DB_NOME = "flashcards-db";
const DB_VERSAO = 2;
let _db = null;

// ---------- Preparação para sincronizar ----------
// Número único para cada deck, cartão e revisão (não se repete entre aparelhos)
let _ultimoId = 0;
function novoId() {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (id <= _ultimoId) id = _ultimoId + 1;
  _ultimoId = id;
  return id;
}

// Só fica verdadeiro quando a sincronização estiver ligada (etapa 4C-2)
function nuvemPronta() {
  return !!(window.nuvem && window.nuvem.pronta);
}

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NOME, DB_VERSAO);

    // Roda só na primeira vez: cria as "gavetas" de dados
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("decks")) {
        db.createObjectStore("decks", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cards")) {
        const s = db.createObjectStore("cards", { keyPath: "id", autoIncrement: true });
        s.createIndex("deckId", "deckId", { unique: false });
      }
      if (!db.objectStoreNames.contains("revisoes")) {
        db.createObjectStore("revisoes", { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

// Ajudante genérico: executa uma operação em uma gaveta
async function transacao(nomeStore, modo, operacao) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nomeStore, modo);
    const req = operacao(tx.objectStore(nomeStore));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

// Lê os decks. Deck antigo (sem parentId) vira deck da raiz.
// Deck cujo pai não existe mais também é tratado como raiz.
async function listarDecks() {
  const decks = await transacao("decks", "readonly", (s) => s.getAll());
  const ids = new Set(decks.map((d) => d.id));
  return decks.map((d) => ({
    ...d,
    parentId: d.parentId != null && ids.has(d.parentId) && d.parentId !== d.id ? d.parentId : null,
  }));
}

async function salvarDeck(deck) {
  const d = { ...deck, id: deck.id ?? novoId(), atualizadoEm: Date.now() };
  await transacao("decks", "readwrite", (s) => s.put(d));
  if (nuvemPronta()) window.nuvem.salvar("decks", d);
  return d.id;
}

// Apagar um deck também apaga todos os cartões dele (não mexe nos subdecks)
async function apagarDeck(id) {
  const db = await abrirBanco();
  const idsCards = [];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["decks", "cards"], "readwrite");
    tx.objectStore("decks").delete(id);

    const cards = tx.objectStore("cards");
    const cursor = cards.index("deckId").openKeyCursor(IDBKeyRange.only(id));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        idsCards.push(c.primaryKey);
        cards.delete(c.primaryKey);
        c.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (nuvemPronta()) window.nuvem.apagarDeck(id, idsCards);
}

// ---------- Árvore de decks (subdecks) ----------
// Filhos diretos de um deck (paiId = null devolve os decks da raiz), em ordem alfabética
function filhosDe(decks, paiId) {
  return decks
    .filter((d) => (d.parentId ?? null) === paiId)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Id do deck + ids de todos os descendentes (filhos, netos...)
function idsDaSubarvore(decks, id) {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    decks.forEach((d) => {
      if ((d.parentId ?? null) === ids[i] && !ids.includes(d.id)) ids.push(d.id);
    });
  }
  return ids;
}

// "Cirurgia::Cirurgia Geral::Trauma"
function caminhoDoDeck(decks, id) {
  const partes = [];
  const vistos = new Set();
  let atual = decks.find((d) => d.id === id);
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    partes.unshift(atual.nome);
    const paiId = atual.parentId ?? null;
    atual = paiId === null ? null : decks.find((d) => d.id === paiId);
  }
  return partes.join("::");
}

// Já existe, dentro deste pai, um deck com esse nome? (ignora maiúsculas)
function nomeDuplicado(decks, paiId, nome, ignorarId = null) {
  const alvo = nome.trim().toLowerCase();
  return decks.some(
    (d) =>
      d.id !== ignorarId &&
      (d.parentId ?? null) === paiId &&
      d.nome.trim().toLowerCase() === alvo
  );
}

// Cria (se faltar) cada nível de "A::B::C" e devolve o id do último (usado na importação)
async function garantirCaminho(caminho, paiId = null) {
  const partes = caminho.split("::").map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) throw new Error("Nome de deck vazio.");
  let decks = await listarDecks();
  let pai = paiId;
  for (const nome of partes) {
    const existente = decks.find(
      (d) => (d.parentId ?? null) === pai && d.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (existente) {
      pai = existente.id;
      continue;
    }
    pai = await salvarDeck({ nome, parentId: pai, criadoEm: Date.now() });
    decks = await listarDecks();
  }
  return pai;
}

// Mover um deck (e tudo que está dentro dele) para outro pai; null = raiz
async function moverDeck(id, novoPaiId) {
  const decks = await listarDecks();
  const deck = decks.find((d) => d.id === id);
  if (!deck) throw new Error("Deck não encontrado.");
  if (novoPaiId !== null && idsDaSubarvore(decks, id).includes(novoPaiId)) {
    throw new Error("Não dá para mover um deck para dentro dele mesmo ou de um subdeck dele.");
  }
  if (nomeDuplicado(decks, novoPaiId, deck.nome, id)) {
    throw new Error('Já existe um deck chamado "' + deck.nome + '" nesse destino.');
  }
  await salvarDeck({ ...deck, parentId: novoPaiId });
}

// Excluir um deck que pode ter subdecks.
// modo "tudo": apaga o deck, todos os subdecks e todos os cartões.
// modo "mover": os subdecks diretos e os cartões do deck vão para destinoId (null = raiz,
// só vale se o deck não tiver cartões próprios) e só o deck é apagado.
async function apagarDeckArvore(id, modo, destinoId = null) {
  const decks = await listarDecks();
  const sub = idsDaSubarvore(decks, id);

  if (modo === "tudo") {
    for (const x of [...sub].reverse()) await apagarDeck(x);
    return;
  }

  if (destinoId !== null && sub.includes(destinoId)) {
    throw new Error("O destino não pode estar dentro do deck que será apagado.");
  }
  const cards = await listarCards(id);
  if (cards.length > 0 && destinoId === null) {
    throw new Error("Escolha um deck para receber os cartões.");
  }

  // Subdecks diretos vão para o destino (se o nome já existir lá, vira "Nome (2)")
  const filhos = decks.filter((d) => (d.parentId ?? null) === id);
  const nomesNoDestino = decks
    .filter((d) => (d.parentId ?? null) === destinoId)
    .map((d) => d.nome.trim().toLowerCase());
  for (const f of filhos) {
    let nome = f.nome;
    let n = 2;
    while (nomesNoDestino.includes(nome.trim().toLowerCase())) {
      nome = f.nome + " (" + n + ")";
      n++;
    }
    nomesNoDestino.push(nome.trim().toLowerCase());
    await salvarDeck({ ...f, nome, parentId: destinoId });
  }

  if (cards.length > 0) {
    await salvarVariosCards(cards.map((c) => ({ ...c, deckId: destinoId })));
  }
  await apagarDeck(id);
}

const listarCards = (deckId) =>
  transacao("cards", "readonly", (s) => s.index("deckId").getAll(deckId));

const contarCards = (deckId) =>
  transacao("cards", "readonly", (s) => s.index("deckId").count(deckId));

async function salvarCard(card) {
  const c = { ...card, id: card.id ?? novoId(), atualizadoEm: Date.now() };
  await transacao("cards", "readwrite", (s) => s.put(c));
  if (nuvemPronta()) window.nuvem.salvar("cards", c);
  return c.id;
}

async function apagarCard(id) {
  await transacao("cards", "readwrite", (s) => s.delete(id));
  if (nuvemPronta()) window.nuvem.apagar("cards", id);
}

async function salvarRevisao(rev) {
  const r = { ...rev, id: rev.id ?? novoId() };
  await transacao("revisoes", "readwrite", (s) => s.put(r));
  if (nuvemPronta()) window.nuvem.salvarRevisao(r);
}

// Lê tudo que está guardado, para o backup
async function exportarTudo() {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["decks", "cards", "revisoes"], "readonly");
    const saida = {};
    ["decks", "cards", "revisoes"].forEach((nome) => {
      const req = tx.objectStore(nome).getAll();
      req.onsuccess = () => {
        saida[nome] = req.result;
      };
    });
    tx.oncomplete = () => resolve(saida);
    tx.onerror = () => reject(tx.error);
  });
}

// Apaga tudo e coloca o conteúdo do backup. Se der erro no meio,
// nada muda (é uma operação "tudo ou nada").
async function substituirTudo(dados) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["decks", "cards", "revisoes"], "readwrite");
    ["decks", "cards", "revisoes"].forEach((nome) => {
      const loja = tx.objectStore(nome);
      loja.clear();
      (dados[nome] || []).forEach((item) => loja.put(item));
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Salva vários cartões de uma vez (rápido e "tudo ou nada")
async function salvarVariosCards(lista) {
  const agora = Date.now();
  const cards = lista.map((c) => ({ ...c, id: c.id ?? novoId(), atualizadoEm: agora }));
  const db = await abrirBanco();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readwrite");
    const loja = tx.objectStore("cards");
    cards.forEach((c) => loja.put(c));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  if (nuvemPronta()) window.nuvem.salvarVarios(cards);
}

// Quantos cartões novos e revisões já foram feitos hoje, por deck
// Devolve algo como { 3: { novos: 5, revisoes: 12 } }
async function feitosHojePorDeck() {
  const todas = await transacao("revisoes", "readonly", (s) => s.getAll());
  const inicio = somarDias(Date.now(), 0); // meia-noite de hoje
  const mapa = {};
  for (const r of todas) {
    if (r.quando < inicio) continue;
    if (!mapa[r.deckId]) mapa[r.deckId] = { novos: 0, revisoes: 0 };
    if (r.estadoAntes === "novo") mapa[r.deckId].novos++;
    else if (r.estadoAntes === "revisao") mapa[r.deckId].revisoes++;
  }
  return mapa;
}

function feitosDoDeck(mapa, deckId) {
  return mapa[deckId] || { novos: 0, revisoes: 0 };
}

// Aplica no aparelho uma alteração que veio da nuvem (usada na etapa 4C-2)
async function aplicarRemoto(nome, d) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["decks", "cards", "revisoes"], "readwrite");
    const dados = { ...d };
    delete dados.sv;

    if (nome === "revisoes") {
      const loja = tx.objectStore("revisoes");
      // Revisões nunca mudam: só entram as que ainda não existem aqui
      (dados.itens || []).forEach((r) => {
        const req = loja.add(r);
        req.onerror = (ev) => ev.preventDefault();
      });
    } else {
      const loja = tx.objectStore(nome);
      const id = Number(dados.id);
      if (dados.apagado) {
        loja.delete(id);
        if (nome === "decks") {
          const cards = tx.objectStore("cards");
          const cur = cards.index("deckId").openKeyCursor(IDBKeyRange.only(id));
          cur.onsuccess = () => {
            const c = cur.result;
            if (c) {
              cards.delete(c.primaryKey);
              c.continue();
            }
          };
        }
      } else {
        const req = loja.get(id);
        req.onsuccess = () => {
          const local = req.result;
          // só sobrescreve se a versão da nuvem for mais nova
          if (!local || (local.atualizadoEm ?? 0) <= (dados.atualizadoEm ?? 0)) loja.put(dados);
        };
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
