'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Leitor da fatura do cartão Cora.
//
// O layout da Cora não tem espaço entre data, descrição e valor. Sai assim do
// PDF, tudo grudado:
//
//   20/08/2026PANIFICACAO VIDELLI LTD26,00
//   20/04/2026JoseanaAndradeDa 5/6115,83
//   10/04/2026EltonConfeccoes 5/570,40
//
// Isso cria ambiguidade real. Em "5/570,40" a leitura pode ser parcela 5/5 com
// valor 70,40, ou parcela 5/57 com valor 0,40. Duas regras resolvem:
//   - o número da parcela nunca é maior que o total (5/57 passaria, 4/1 não)
//   - o total de parcelas é sempre 2 ou mais (uma parcela só não se escreve)
// Com as duas, "4/1210,90" só pode ser parcela 4/12 e valor 10,90.
//
// A fatura é empresarial e agrupa as compras POR PORTADOR, em blocos que
// começam com "NOME •••• 1234". O portador é guardado em cada linha.
//
// COMPRA INTERNACIONAL
// Vem com linhas de detalhe logo abaixo:
//
//   15/08/2026AURA PRO140,57
//   USD 25,00 / USD 25,00
//   Conversão na data - R$ 5,4325
//   IOF - R$ 4,75
//
// O IOF NÃO é cobrança separada: ele já está dentro dos 140,57. Conferido na
// fatura real (112,79 USD x 5,3933 = 608,32, mais 21,29 de IOF, dá os 629,61
// lançados). Capturar essas linhas como lançamento contaria o IOF duas vezes.
// Por isso elas são descartadas, e o valor internacional fica no complemento.
// ─────────────────────────────────────────────────────────────────────────

const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const semAcento = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "1.234,56" -> 1234.56 */
function paraNumero(bruto) {
  const n = Number(String(bruto).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Linha de lançamento: data colada na descrição.
const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/;

// Valor no fim, sem parcela.
const RE_VALOR = /^(.+?)(\d{1,3}(?:\.\d{3})*,\d{2})$/;

// Parcela colada no valor. O total de parcelas é preguiçoso de propósito:
// tenta 1 dígito antes de 2, e as validações abaixo decidem.
const RE_PARCELA_VALOR = /^(.+?)\s(\d{1,2})\/(\d{1,2}?)(\d{1,3}(?:\.\d{3})*,\d{2})$/;

// Cabeçalho de bloco de portador: "RAONI TOTALI •••• 1335".
const RE_PORTADOR = /^(.+?)\s*[•*.]{3,}\s*(\d{4})\s*$/;

// Linhas de detalhe da compra internacional e ruído de layout.
const RE_DETALHE = new RegExp([
  '^(USD|BRL|EUR)\\s', '^Conversao na data', '^IOF\\s*-\\s*R\\$',
  '^Limite utilizado', '^DataDescricao', '^Lancamentos$',
  '^CNPJ', '^Cora Sociedade', '^pag \\d', '^Ola,',
].join('|'), 'i');

/** Só é parcela se fizer sentido: 1 <= numero <= total e total >= 2. */
const parcelaValida = (n, t) => n >= 1 && t >= 2 && n <= t && t <= 72;

function detectar(texto) {
  const t = semAcento(texto);
  return /Cora Sociedade de Credito Direto/i.test(t) ||
         /DataDescricao do LancamentoValores em R\$/i.test(t);
}

function lerCabecalho(texto) {
  const linhas = semAcento(texto).split(/\r?\n/).map((l) => l.trim());
  const t = linhas.join('\n');

  // Período: "10/08/2026 a 10/09/2026". Dá o ano e a data de referência.
  const periodo = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/);
  const fimPeriodo = periodo
    ? new Date(Date.UTC(Number(periodo[6]), Number(periodo[5]) - 1, Number(periodo[4])))
    : null;

  // Vencimento vem por extenso e SEM ano: "Vencimento:  15 de setembro".
  // O ano sai do período da fatura.
  let dataVencimento = null;
  const venc = t.match(/Vencimento:?\s*(\d{1,2})\s+de\s+([a-z]+)/i);
  if (venc) {
    const mes = MESES[venc[2].toLowerCase()];
    const ano = fimPeriodo ? fimPeriodo.getUTCFullYear() : new Date().getFullYear();
    if (mes) dataVencimento = new Date(Date.UTC(ano, mes - 1, Number(venc[1])));
  }

  // "Total a pagar:  R$ 3.007,29" — o que de fato se deve.
  const totalPagar = t.match(/Total a pagar:?\s*R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);
  // "Total de compras: R$ 3.107,29" — a soma das linhas de lançamento.
  const totalCompras = t.match(/Total de compras[^R]*R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);

  return {
    dataVencimento,
    fimPeriodo,
    valorTotalInformado: totalPagar ? paraNumero(totalPagar[1]) : null,
    totalCompras:        totalCompras ? paraNumero(totalCompras[1]) : null,
  };
}

/**
 * Créditos que aparecem só no resumo, sem data: pagamento antecipado e
 * reembolso. Sem eles a soma das linhas não fecha com o total a pagar.
 */
function lerCreditos(texto, dataRef) {
  const t = semAcento(texto);
  const creditos = [];

  const achar = (rotulo, tipo) => {
    const m = t.match(new RegExp(`${rotulo}\\s*-?\\s*R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2})`, 'i'));
    const v = m ? paraNumero(m[1]) : 0;
    if (v > 0) {
      creditos.push({
        dataCompra: dataRef, descricao: rotulo, valor: v, tipo,
        parcelaNumero: null, parcelaTotal: null, portador: null,
      });
    }
  };

  achar('Pagamentos antecipados', 'pagamento');
  achar('Reembolsos', 'estorno');
  return creditos;
}

function extrair(texto) {
  const cabecalho = lerCabecalho(texto);
  const dataRef = cabecalho.fimPeriodo || cabecalho.dataVencimento || new Date();

  const linhas = [];
  const brutas = semAcento(texto).split(/\r?\n/).map((l) => l.trim());

  let portadorAtual = null;
  // Quando a linha tem data mas o valor caiu na linha seguinte, a compra fica
  // pendurada aqui esperando o número.
  let pendente = null;

  // O bloco de lançamentos começa depois de "Lancamentos". Antes disso há
  // resumos cheios de valores que não são compra.
  const inicio = brutas.findIndex((l) => /^Lancamentos$/i.test(l));
  const corpo = inicio >= 0 ? brutas.slice(inicio) : brutas;

  for (const linha of corpo) {
    if (!linha) continue;

    // Valor solto logo abaixo de uma compra sem valor.
    if (pendente) {
      const so = linha.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})$/);
      if (so) {
        linhas.push({ ...pendente, valor: paraNumero(so[1]) });
        pendente = null;
        continue;
      }
      // Não veio valor: a compra pendurada não tinha valor mesmo. Descarta.
      pendente = null;
    }

    if (RE_DETALHE.test(linha)) continue;

    const mData = linha.match(RE_DATA);
    if (!mData) {
      // Sem data: pode ser o cabeçalho de um portador.
      const mPort = linha.match(RE_PORTADOR);
      if (mPort) portadorAtual = `${mPort[1].trim()} ${mPort[2]}`;
      continue;
    }

    const [, dd, mm, aaaa, resto] = mData;
    const dataCompra = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(dd)));
    const texto2 = resto.trim();

    let descricao = null, valor = null, parcelaNumero = null, parcelaTotal = null;

    // Primeiro tenta com parcela, porque "5/570,40" tem que virar 5/5 e 70,40,
    // e não a descrição "5/" com valor 570,40.
    const mp = texto2.match(RE_PARCELA_VALOR);
    if (mp && parcelaValida(Number(mp[2]), Number(mp[3]))) {
      descricao     = mp[1].trim();
      parcelaNumero = Number(mp[2]);
      parcelaTotal  = Number(mp[3]);
      valor         = paraNumero(mp[4]);
    } else {
      // Sem parcela válida: tenta parcela com 2 dígitos no total, caso o
      // preguiçoso tenha pego 1 e reprovado (ex.: "4/1210,90" -> 4/12).
      const mp2 = texto2.match(/^(.+?)\s(\d{1,2})\/(\d{2})(\d{1,3}(?:\.\d{3})*,\d{2})$/);
      if (mp2 && parcelaValida(Number(mp2[2]), Number(mp2[3]))) {
        descricao     = mp2[1].trim();
        parcelaNumero = Number(mp2[2]);
        parcelaTotal  = Number(mp2[3]);
        valor         = paraNumero(mp2[4]);
      } else {
        const mv = texto2.match(RE_VALOR);
        if (mv) {
          descricao = mv[1].trim();
          valor     = paraNumero(mv[2]);
        } else if (texto2) {
          // Data e descrição, sem valor: ele vem na próxima linha.
          pendente = {
            dataCompra, descricao: texto2, tipo: 'compra',
            parcelaNumero: null, parcelaTotal: null, portador: portadorAtual,
          };
          continue;
        }
      }
    }

    if (!descricao || valor === null) continue;

    linhas.push({
      dataCompra, descricao, valor,
      // Toda linha do bloco de lançamentos da Cora é compra. Pagamento e
      // estorno aparecem só no resumo, e entram por lerCreditos().
      tipo: 'compra',
      parcelaNumero, parcelaTotal,
      portador: portadorAtual,
    });
  }

  return {
    cabecalho,
    linhas: [...linhas, ...lerCreditos(texto, dataRef)],
    descartadas: [],
  };
}

module.exports = {
  nome: 'cora',
  rotulo: 'Cora',
  detectar,
  extrair,
  _internos: { paraNumero, parcelaValida, lerCabecalho },
};
