const MIN = 60 * 1000;
const LIMITE_NOVOS_POR_SESSAO = 20;

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

// Monta a fila de estudo: primeiro o que está vencido, depois os novos
function montarFila(cards, agora = Date.now()) {
  const amanha = somarDias(agora, 1);

  const pendentes = cards
    .filter((c) => {
      const e = estadoDoCard(c);
      if (e === "aprendendo") return c.proxima <= agora;
      if (e === "revisao") return c.proxima < amanha;
      return false;
    })
    .sort((a, b) => a.proxima - b.proxima);

  const novos = cards
    .filter((c) => estadoDoCard(c) === "novo")
    .sort((a, b) => a.criadoEm - b.criadoEm)
    .slice(0, LIMITE_NOVOS_POR_SESSAO);

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
