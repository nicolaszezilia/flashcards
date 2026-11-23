import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  query,
  where,
  onSnapshot,
  writeBatch,
  setDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  getDocsFromServer,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let bd = null;
let uid = null;
let desligadores = [];
let iniciando = false;

const colecao = (nome) => collection(bd, "usuarios", uid, nome);
const ref = (nome, id) => doc(bd, "usuarios", uid, nome, String(id));
const aviso = (e) => console.warn("Sincronização:", e);

function diaDe(ts = Date.now()) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error("A conexão demorou demais. Tente de novo.")), ms)
    ),
  ]);
}

function criarBanco(app) {
  try {
    // Guarda uma fila no aparelho: alterações feitas offline são enviadas depois
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    aviso(e);
    return getFirestore(app);
  }
}

// ---------- Usado pelo db.js a cada alteração ----------
window.nuvem = {
  pronta: false,

  salvar(nome, obj) {
    setDoc(ref(nome, obj.id), { ...obj, sv: serverTimestamp() }).catch(aviso);
  },

  // Em vez de apagar de vez, deixa uma "marca de apagado" para o outro aparelho saber
  apagar(nome, id) {
    setDoc(ref(nome, id), {
      id, apagado: true, atualizadoEm: Date.now(), sv: serverTimestamp(),
    }).catch(aviso);
  },

  apagarDeck(id, idsCards) {
    const agora = Date.now();
    const itens = [["decks", id], ...idsCards.map((c) => ["cards", c])];
    for (let i = 0; i < itens.length; i += 400) {
      const lote = writeBatch(bd);
      itens.slice(i, i + 400).forEach(([nome, x]) =>
        lote.set(ref(nome, x), { id: x, apagado: true, atualizadoEm: agora, sv: serverTimestamp() })
      );
      lote.commit().catch(aviso);
    }
  },

  // As revisões ficam agrupadas por dia (1 documento por dia)
  salvarRevisao(rev) {
    setDoc(
      ref("revisoes", diaDe(rev.quando)),
      { itens: arrayUnion(rev), atualizadoEm: Date.now(), sv: serverTimestamp() },
      { merge: true }
    ).catch(aviso);
  },

  salvarVarios(cards) {
    for (let i = 0; i < cards.length; i += 25) {
      const lote = writeBatch(bd);
      cards.slice(i, i + 25).forEach((c) =>
        lote.set(ref("cards", c.id), { ...c, sv: serverTimestamp() })
      );
      lote.commit().catch(aviso);
    }
  },
};

// ---------- Texto de estado em Ajustes ----------
function status() {
  const el = document.getElementById("sync-status");
  if (!el) return;
  if (!window.nuvem.pronta) el.textContent = "";
  else if (navigator.onLine) el.textContent = "Sincronização ligada ✓";
  else el.textContent = "Sem internet: as alterações serão enviadas depois.";
}
window.addEventListener("online", status);
window.addEventListener("offline", status);

// ---------- Janelinha da primeira sincronização ----------
function painel(html) {
  let caixa = document.getElementById("tela-sync");
  if (!caixa) {
    caixa = document.createElement("div");
    caixa.id = "tela-sync";
    document.body.appendChild(caixa);
  }
  caixa.innerHTML = '<div class="sync-cartao">' + html + "</div>";
  return caixa;
}
function fecharPainel() {
  const caixa = document.getElementById("tela-sync");
  if (caixa) caixa.remove();
}

function perguntarModo(local, nuvemDecks) {
  return new Promise((resolve) => {
    const caixa = painel(
      "<h2>Primeira sincronização</h2>" +
      "<p>Este aparelho tem <b>" + local.decks.length + "</b> deck(s) e <b>" +
      local.cards.length + "</b> cartão(ões).</p>" +
      "<p>Sua conta na nuvem já tem <b>" + nuvemDecks + "</b> deck(s).</p>" +
      "<p>Se os decks daqui são os mesmos que já estão na conta, escolha a segunda opção " +
      "para não duplicar.</p>" +
      '<button id="sync-enviar">Enviar os dados deste aparelho para a conta</button>' +
      '<button id="sync-nuvem" class="perigo">Usar só os dados da conta (apaga os deste aparelho)</button>'
    );
    caixa.querySelector("#sync-enviar").addEventListener("click", () => resolve("enviar"));
    caixa.querySelector("#sync-nuvem").addEventListener("click", () => {
      if (confirm("Isso APAGA os decks e cartões deste aparelho e traz os da conta. Continuar?")) {
        resolve("nuvem");
      }
    });
  });
}

// ---------- Envia tudo que está neste aparelho ----------
async function enviarTudoDesteAparelho() {
  const dados = await exportarTudo();
  const agora = Date.now();
  const antigo = (id) => id < 1e14; // ids da época 1, 2, 3...

  const mapaDeck = new Map();
  const mapaCard = new Map();

  const decks = dados.decks.map((d) => {
    const id = antigo(d.id) ? novoId() : d.id;
    mapaDeck.set(d.id, id);
    return { ...d, id, atualizadoEm: d.atualizadoEm ?? agora };
  });
  const cards = dados.cards.map((c) => {
    const id = antigo(c.id) ? novoId() : c.id;
    mapaCard.set(c.id, id);
    return {
      ...c, id,
      deckId: mapaDeck.get(c.deckId) ?? c.deckId,
      atualizadoEm: c.atualizadoEm ?? agora,
    };
  });
  const revisoes = (dados.revisoes || []).map((r) => ({
    ...r,
    id: antigo(r.id) ? novoId() : r.id,
    cardId: mapaCard.get(r.cardId) ?? r.cardId,
    deckId: mapaDeck.get(r.deckId) ?? r.deckId,
  }));

  // Primeiro renumera aqui no aparelho ("tudo ou nada")
  await substituirTudo({ decks, cards, revisoes });

  // Depois sobe para a nuvem, aos poucos
  const itens = [...decks.map((d) => ["decks", d]), ...cards.map((c) => ["cards", c])];
  let feitos = 0;
  for (let i = 0; i < itens.length; i += 25) {
    const lote = writeBatch(bd);
    itens.slice(i, i + 25).forEach(([nome, x]) =>
      lote.set(ref(nome, x.id), { ...x, sv: serverTimestamp() })
    );
    await comTimeout(lote.commit(), 90000);
    feitos += Math.min(25, itens.length - i);
    painel("<h2>Enviando…</h2><p>" + feitos + " de " + itens.length + " itens</p>");
  }

  const porDia = new Map();
  revisoes.forEach((r) => {
    const k = diaDe(r.quando);
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(r);
  });
  const dias = [...porDia.entries()];
  for (let i = 0; i < dias.length; i += 20) {
    const lote = writeBatch(bd);
    dias.slice(i, i + 20).forEach(([dia, lista]) =>
      lote.set(
        ref("revisoes", dia),
        { itens: arrayUnion(...lista), atualizadoEm: agora, sv: serverTimestamp() },
        { merge: true }
      )
    );
    await comTimeout(lote.commit(), 90000);
  }
}

async function primeiraSincronizacao() {
  if (!navigator.onLine) {
    throw new Error("Conecte-se à internet para a primeira sincronização.");
  }
  painel("<h2>Verificando sua conta…</h2>");
  try {
    const local = await exportarTudo();
    const snap = await comTimeout(getDocsFromServer(query(colecao("decks"))), 30000);
    const nuvemDecks = snap.docs.filter((d) => !d.data().apagado).length;

    let modo;
    if (local.decks.length === 0) modo = "nuvem";
    else if (nuvemDecks === 0) modo = "enviar";
    else modo = await perguntarModo(local, nuvemDecks);

    if (modo === "enviar") {
      await enviarTudoDesteAparelho();
    } else {
      painel("<h2>Baixando seus dados…</h2>");
      await substituirTudo({ decks: [], cards: [], revisoes: [] });
    }
  } finally {
    fecharPainel();
  }
}

// ---------- Recebe alterações do outro aparelho ----------
const chaveEstado = () => "sync:" + uid;

function lerEstado() {
  try {
    return JSON.parse(localStorage.getItem(chaveEstado()) || "null");
  } catch (e) {
    return null;
  }
}
function guardarDesde(nome, valor) {
  const estado = lerEstado() || { decks: 0, cards: 0, revisoes: 0 };
  if (valor > (estado[nome] || 0)) {
    estado[nome] = valor;
    localStorage.setItem(chaveEstado(), JSON.stringify(estado));
  }
}

function desligar() {
  desligadores.forEach((f) => f());
  desligadores = [];
}

function ouvir(estado) {
  desligar();
  ["decks", "cards", "revisoes"].forEach((nome) => {
    const desde = Timestamp.fromMillis(estado[nome] || 0);
    const q = query(colecao(nome), where("sv", ">", desde));
    desligadores.push(
      onSnapshot(
        q,
        async (snap) => {
          let maior = 0;
          let mudou = false;
          for (const c of snap.docChanges()) {
            if (c.type === "removed" || c.doc.metadata.hasPendingWrites) continue;
            const dados = c.doc.data();
            if (!dados.sv) continue;
            maior = Math.max(maior, dados.sv.toMillis());
            try {
              await aplicarRemoto(nome, dados);
              mudou = true;
            } catch (e) {
              aviso(e);
            }
          }
          if (maior) guardarDesde(nome, maior - 1000);
          if (mudou && window.atualizarTela) window.atualizarTela();
        },
        aviso
      )
    );
  });
}

// ---------- Liga e desliga (chamados pelo auth.js) ----------
export async function iniciarNuvem(app, user) {
  if (iniciando || (uid === user.uid && window.nuvem.pronta)) return;
  iniciando = true;
  try {
    uid = user.uid;
    if (!bd) bd = criarBanco(app);

    let estado = lerEstado();
    if (!estado) {
      await primeiraSincronizacao();
      estado = { decks: 0, cards: 0, revisoes: 0 };
      localStorage.setItem(chaveEstado(), JSON.stringify(estado));
    }

    window.nuvem.pronta = true;
    status();
    ouvir(estado);
    if (window.atualizarTela) window.atualizarTela();
  } catch (e) {
    aviso(e);
    window.nuvem.pronta = false;
    status();
    alert(
      "Não consegui ligar a sincronização: " + (e.message || e) +
      "\n\nO app continua funcionando neste aparelho. Tente de novo ao reabrir, com internet."
    );
  } finally {
    iniciando = false;
  }
}

export function pararNuvem() {
  desligar();
  uid = null;
  window.nuvem.pronta = false;
  status();
}
