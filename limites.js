// limites.js — Fase 2, Etapa 5: limites diários em Ajustes
(function () {
  const caixa = document.createElement("div");
  caixa.className = "limites";
  caixa.innerHTML = `
    <h3>Limites diários (por deck)</h3>
    <label for="lim-novos">Cartões novos por dia</label>
    <input type="number" id="lim-novos" inputmode="numeric" min="0" max="9999">
    <label for="lim-rev">Revisões por dia</label>
    <input type="number" id="lim-rev" inputmode="numeric" min="0" max="9999">`;

  const ancora = document.getElementById("btn-exportar-anki") || document.getElementById("btn-importar");
  ancora.after(caixa);

  const campoNovos = document.getElementById("lim-novos");
  const campoRev = document.getElementById("lim-rev");
  const atuais = lerLimites();
  campoNovos.value = atuais.novos;
  campoRev.value = atuais.revisoes;

  // Guarda ao terminar de digitar; valor inválido volta ao padrão
  function guardar(chave, campo, padrao) {
    campo.addEventListener("change", () => {
      let v = parseInt(campo.value, 10);
      if (isNaN(v) || v < 0) v = padrao;
      localStorage.setItem(chave, String(v));
      campo.value = v;
    });
  }
  guardar("limiteNovos", campoNovos, 20);
  guardar("limiteRevisoes", campoRev, 200);
})();
