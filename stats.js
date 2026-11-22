// stats.js — Fase 2, Etapa 6: estatísticas simples
(function () {
  // ---------- Estilo (só desta janela) ----------
  const estilo = document.createElement("style");
  estilo.textContent = `
  .est-grade{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .est-bloco{background:rgba(128,128,128,.15);border-radius:12px;padding:10px 6px;text-align:center}
  .est-num{font-size:24px;font-weight:700;line-height:1.2}
  .est-leg{font-size:12px;opacity:.75;margin-top:2px}
  .est-grafico{display:flex;align-items:flex-end;gap:3px;height:120px;margin:16px 0 4px}
  .est-barra{flex:1;min-height:2px;background:#4f8cff;border-radius:3px 3px 0 0}
  .est-barra.est-vazia{background:rgba(128,128,128,.35)}
  .est-rotulos{display:flex;gap:3px;font-size:12px;opacity:.75}
  .est-rotulos span{flex:1;text-align:center}
  .est-resumo{margin:12px 0;font-size:15px;line-height:1.7}
  .imp-linha button.est-ativo{background:rgba(79,140,255,.25);border-color:#4f8cff}
  `;
  document.head.appendChild(estilo);

  // ---------- Janela ----------
  const fundo = document.createElement("div");
  fundo.className = "imp-fundo";
  fundo.innerHTML = `
    <div class="imp-caixa">
      <h2>Estatísticas</h2>

      <div class="est-grade">
        <div class="est-bloco"><div class="est-num" id="est-seq">0</div><div class="est-leg">sequência atual (dias)</div></div>
        <div class="est-bloco"><div class="est-num" id="est-melhor">0</div><div class="est-leg">melhor sequência</div></div>
        <div class="est-bloco"><div class="est-num" id="est-hoje">0</div><div class="est-leg">cartões hoje</div></div>
      </div>

      <div class="imp-linha">
        <button type="button" id="est-7" class="est-ativo">7 dias</button>
        <button type="button" id="est-30">30 dias</button>
      </div>

      <div class="est-grafico" id="est-grafico"></div>
      <div class="est-rotulos" id="est-rot1"></div>
      <div class="est-rotulos" id="est-rot2"></div>

      <div class="est-resumo" id="est-resumo"></div>

      <div class="imp-linha">
        <button type="button" id="est-fechar" class="imp-principal">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(fundo);

  const $ = (id) => document.getElementById(id);
  let todas = [];   // todo o histórico de revisões
  let periodo = 7;  // 7 ou 30 dias

  // ---------- Datas ----------
  // "2026-11-22" no horário do aparelho
  function chaveDia(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // Meio-dia de n dias atrás (meio-dia evita problemas de horário de verão)
  function diasAtras(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  // ---------- Cálculo e desenho ----------
  function desenhar() {
    // Quais cartões diferentes foram estudados em cada dia
    const porDia = {};
    for (const r of todas) {
      const k = chaveDia(r.quando);
      if (!porDia[k]) porDia[k] = new Set();
      porDia[k].add(r.cardId);
    }
    const diasComEstudo = new Set(Object.keys(porDia));

    // Sequência atual: se hoje ainda não estudou, conta a partir de ontem
    let atual = 0;
    let i = diasComEstudo.has(chaveDia(diasAtras(0).getTime())) ? 0 : 1;
    while (diasComEstudo.has(chaveDia(diasAtras(i).getTime()))) {
      atual++;
      i++;
    }

    // Melhor sequência de todos os tempos
    let melhor = 0, corrente = 0, anterior = null;
    for (const k of [...diasComEstudo].sort()) {
      const [a, m, d] = k.split("-").map(Number);
      const dt = new Date(a, m - 1, d, 12);
      if (anterior && Math.round((dt - anterior) / 86400000) === 1) corrente++;
      else corrente = 1;
      melhor = Math.max(melhor, corrente);
      anterior = dt;
    }

    const hoje = porDia[chaveDia(Date.now())];
    $("est-seq").textContent = atual;
    $("est-melhor").textContent = melhor;
    $("est-hoje").textContent = hoje ? hoje.size : 0;

    // Dias do período, do mais antigo ao de hoje
    const lista = [];
    for (let j = periodo - 1; j >= 0; j--) {
      const d = diasAtras(j);
      const k = chaveDia(d.getTime());
      lista.push({ d, qtd: porDia[k] ? porDia[k].size : 0 });
    }

    // Gráfico de barras
    const maximo = Math.max(1, ...lista.map((x) => x.qtd));
    $("est-grafico").innerHTML = lista
      .map((x) => {
        const altura = Math.max(2, Math.round((x.qtd / maximo) * 100));
        return '<div class="est-barra' + (x.qtd ? "" : " est-vazia") + '" style="height:' + altura + '%"></div>';
      })
      .join("");

    // Números e dias da semana só no gráfico de 7 dias
    const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    $("est-rot1").innerHTML = periodo <= 7 ? lista.map((x) => "<span>" + x.qtd + "</span>").join("") : "";
    $("est-rot2").innerHTML = periodo <= 7 ? lista.map((x) => "<span>" + semana[x.d.getDay()] + "</span>").join("") : "";

    // Resumo do período
    if (todas.length === 0) {
      $("est-resumo").textContent = "Ainda não há revisões registradas. Estude alguns cartões e volte aqui.";
      return;
    }

    const inicio = new Date(lista[0].d);
    inicio.setHours(0, 0, 0, 0);
    let respostas = 0, acertos = 0;
    for (const r of todas) {
      if (r.quando >= inicio.getTime()) {
        respostas++;
        if (r.nota !== 0) acertos++;
      }
    }

    const total = lista.reduce((soma, x) => soma + x.qtd, 0);
    const media = (total / periodo).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const dd = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
    const taxa = respostas ? Math.round((acertos / respostas) * 100) + "%" : "—";

    $("est-resumo").innerHTML =
      "Período: " + dd(lista[0].d) + " a " + dd(lista[lista.length - 1].d) + "<br>" +
      "Cartões estudados: <b>" + total + "</b> (média de " + media + " por dia)<br>" +
      "Respostas: <b>" + respostas + "</b> · Taxa de acerto: <b>" + taxa + "</b>";
  }

  // ---------- Abrir / fechar ----------
  async function abrir() {
    todas = await transacao("revisoes", "readonly", (s) => s.getAll());
    desenhar();
    fundo.classList.add("imp-aberto");
  }

  function escolherPeriodo(dias) {
    periodo = dias;
    $("est-7").classList.toggle("est-ativo", dias === 7);
    $("est-30").classList.toggle("est-ativo", dias === 30);
    desenhar();
  }

  $("est-7").addEventListener("click", () => escolherPeriodo(7));
  $("est-30").addEventListener("click", () => escolherPeriodo(30));
  $("est-fechar").addEventListener("click", () => fundo.classList.remove("imp-aberto"));
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fundo.classList.remove("imp-aberto"); });

  // Botão novo na aba Ajustes, logo abaixo do "Exportar deck para o Anki"
  const ancora = document.getElementById("btn-exportar-anki") || document.getElementById("btn-importar");
  const botao = document.createElement("button");
  botao.id = "btn-estatisticas";
  botao.className = ancora.className;
  botao.textContent = "Estatísticas";
  botao.addEventListener("click", abrir);
  ancora.after(botao);
})();
