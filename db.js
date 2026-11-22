const DB_NOME = "flashcards-db";
const DB_VERSAO = 1;
let _db = null;

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
const salvarDeck = (deck) => transacao("decks", "readwrite", (s) => s.put(deck));

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
