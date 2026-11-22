const MIN = 60 * 1000;
// Limites diários (guardados em Ajustes). Padrão: 20 novos e 200 revisões.
function lerLimites() {
  const ler = (chave, padrao) => {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : Number(v);
  };
  return { novos: ler("limiteNovos", 20), revisoes: ler("limiteRevisoes", 200) };
}

// Meia-noite de hoje + n dias
function somarDias(ts, n) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Cartões criados antes desta etapa não têm estado: contam como "novo"
function estadoDoCard(card) {
  return card.estado || "novo";
}

// Monta a fila de estudo: o que está vencido, depois os novos,
// respeitando o que ainda sobra do limite de hoje
function montarFila(cards, feitos = { novos: 0, revisoes: 0 }, agora = Date.now()) {
  const lim = lerLimites();
  const vagasNovos = Math.max(0, lim.novos - feitos.novos);
  const vagasRev = Math.max(0, lim.revisoes - feitos.revisoes);
  const amanha = somarDias(agora, 1);

  const aprendendo = cards.filter(
    (c) => estadoDoCard(c) === "aprendendo" && c.proxima <= agora
  );

  const revisoes = cards
    .filter((c) => estadoDoCard(c) === "revisao" && c.proxima < amanha)
    .sort((a, b) => a.proxima - b.proxima)
    .slice(0, vagasRev);

  const novos = cards
    .filter((c) => estadoDoCard(c) === "novo")
    .sort((a, b) => a.criadoEm - b.criadoEm)
    .slice(0, vagasNovos);

  const pendentes = [...aprendendo, ...revisoes].sort((a, b) => a.proxima - b.proxima);
  return [...pendentes, ...novos];
}

// nota: 0 = Errei, 1 = Difícil, 2 = Bom, 3 = Fácil
// Devolve uma CÓPIA do cartão com o novo agendamento
function calcularRevisao(card, nota, agora = Date.now()) {
  const estado = estadoDoCard(card);
  let facilidade = card.facilidade ?? 2.5;
  let intervalo = card.intervalo ?? 0;
  let erros = card.erros ?? 0;
  let novoEstado;
  let proxima;

  if (estado === "revisao") {
    if (nota === 0) {
      facilidade = Math.max(1.3, facilidade - 0.2);
      erros += 1;
      intervalo = 0;
      novoEstado = "aprendendo";
      proxima = agora + 1 * MIN;
    } else {
      if (nota === 1) {
        intervalo = Math.max(intervalo + 1, Math.round(intervalo * 1.2));
        facilidade = Math.max(1.3, facilidade - 0.15);
      } else if (nota === 2) {
        intervalo = Math.max(intervalo + 1, Math.round(intervalo * facilidade));
            } else {
        const bom = Math.max(intervalo + 1, Math.round(intervalo * facilidade));
        intervalo = Math.max(bom + 1, Math.round(intervalo * facilidade * 1.3));
        facilidade += 0.15;
      }
      novoEstado = "revisao";
      proxima = somarDias(agora, intervalo);
    }
  } else {
    // cartão novo ou ainda aprendendo
    if (nota === 0) {
      novoEstado = "aprendendo";
      proxima = agora + 1 * MIN;
    } else if (nota === 1) {
      novoEstado = "aprendendo";
      proxima = agora + 5 * MIN;
    } else {
      novoEstado = "revisao";
      intervalo = nota === 2 ? 1 : 4;
      proxima = somarDias(agora, intervalo);
    }
  }

  return {
    ...card,
    estado: novoEstado,
    facilidade,
    intervalo,
    erros,
    proxima,
    ultimaRevisao: agora,
  };
}

// Texto que aparece embaixo de cada botão (ex.: "10 min", "4 d")
function textoPrevia(card, nota) {
  const agora = Date.now();
  const r = calcularRevisao(card, nota, agora);

  if (r.estado === "aprendendo") {
    return Math.max(1, Math.round((r.proxima - agora) / MIN)) + " min";
  }

  const d = r.intervalo;
  if (d < 30) return d + " d";
  if (d < 365) {
    const m = Math.round(d / 30);
    return m + (m === 1 ? " mês" : " meses");
  }
  return (d / 365).toFixed(1).replace(".", ",") + " anos";
}

// Conta o que está pendente hoje, no mesmo critério de montarFila
function contarPendentes(cards, feitos = { novos: 0, revisoes: 0 }, agora = Date.now()) {
  const lim = lerLimites();
  const amanha = somarDias(agora, 1);
  let novos = 0;
  let aprender = 0;
  let revisar = 0;

  for (const c of cards) {
    const e = estadoDoCard(c);
    if (e === "novo") novos++;
    else if (e === "aprendendo") {
      if (c.proxima <= agora) aprender++;
    } else if (c.proxima < amanha) {
      revisar++;
    }
  }

  return {
    novos: Math.min(novos, Math.max(0, lim.novos - feitos.novos)),
    aprender: aprender,
    revisar: Math.min(revisar, Math.max(0, lim.revisoes - feitos.revisoes)),
  };
}
