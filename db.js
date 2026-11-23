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

const listarDecks = () => transacao("decks", "readonly", (s) => s.getAll());
async function salvarDeck(deck) {
  const d = { ...deck, id: deck.id ?? novoId(), atualizadoEm: Date.now() };
  await transacao("decks", "readwrite", (s) => s.put(d));
  if (nuvemPronta()) window.nuvem.salvar("decks", d);
  return d.id;
}

// Apagar um deck também apaga todos os cartões dele
async function apagarDeck(id) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["decks", "cards"], "readwrite");
    tx.objectStore("decks").delete(id);

    const cards = tx.objectStore("cards");
    const cursor = cards.index("deckId").openKeyCursor(IDBKeyRange.only(id));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        cards.delete(c.primaryKey);
        c.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const listarCards = (deckId) =>
  transacao("cards", "readonly", (s) => s.index("deckId").getAll(deckId));

const contarCards = (deckId) =>
  transacao("cards", "readonly", (s) => s.index("deckId").count(deckId));

const salvarCard = (card) => transacao("cards", "readwrite", (s) => s.put(card));

const apagarCard = (id) => transacao("cards", "readwrite", (s) => s.delete(id));

const salvarRevisao = (rev) => transacao("revisoes", "readwrite", (s) => s.add(rev));

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
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readwrite");
    const loja = tx.objectStore("cards");
    lista.forEach((c) => loja.add(c));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
