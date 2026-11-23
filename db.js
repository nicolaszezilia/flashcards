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
