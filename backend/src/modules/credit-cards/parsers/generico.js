'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Leitor genérico de fatura de cartão.
//
// Cobre o formato mais comum no Brasil: uma linha por lançamento, começando
// pela data, descrição no meio, valor no fim com vírgula decimal.
//
//   10/09  UBER *TRIP SAO PAULO          25,90
//   12/09  MERCADO LIVRE*LOJA 03/10       99,90
//   13/09  PAGAMENTO FATURA ANTERIOR    -500,00
//
// Leitor por emissor (Nubank, Itaú, Bradesco) entra em arquivo próprio, com a
// mesma interface. Este é o fallback e o ponto de partida enquanto não há
// fatura real daquele emissor para calibrar.
// ─────────────────────────────────────────────────────────────────────────

// Data no começo: DD/MM ou DD/MM/AAAA. Também aceita "10 SET" abreviado.
const MESES = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

const RE_DATA_NUM  = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+/;
const RE_DATA_ABREV = /^(\d{2})\s+([A-Z]{3})\s+/;

// Valor no fim da linha. Aceita milhar com ponto, decimal com vírgula, sinal
// antes ou depois, e o "D"/"C" que alguns emissores usam para débito e crédito.
const RE_VALOR_FIM = /(-?\s*R?\$?\s*-?\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])?\s*$/;

// Parcela no meio da descrição: "03/10", "PARC 3/10", "3 DE 10".
const RE_PARCELA = /(?:\bPARC(?:ELA)?\.?\s*)?\b(\d{1,2})\s*(?:\/|\bDE\b)\s*(\d{1,2})\b/;

// Linhas que não são lançamento. Ordem não importa: basta uma casar.
const RE_DESCARTE = new RegExp([
  'TOTAL\\s+(DA\\s+)?FATURA', 'TOTAL\\s+A\\s+PAGAR', 'SALDO\\s+ANTERIOR',
  'LIMITE\\s+(DE\\s+CREDITO|TOTAL|DISPONIVEL)', 'PAGAMENTO\\s+MINIMO',
  'VENCIMENTO', 'FECHAMENTO', 'DEMONSTRATIVO', 'CENTRAL\\s+DE\\s+ATENDIMENTO',
  'OUVIDORIA', 'SAC\\b', 'PAGINA\\s+\\d', 'CNPJ', 'RESUMO\\s+DA\\s+FATURA',
  'PROXIMAS\\s+FATURAS', 'COMPRAS\\s+PARCELADAS\\s*$', 'LANCAMENTOS\\s*$',
].join('|'), 'i');

// Encargos e tarifas: não são compra de mercadoria ou serviço de terceiro.
const RE_ENCARGO = /\b(IOF|JUROS|MULTA|MORA|ANUIDADE|TARIFA|ENCARGO|SEGURO|ROTATIVO|PARCELAMENTO\s+DE\s+FATURA)\b/i;

// Crédito na fatura: pagamento recebido ou devolução.
const RE_PAGAMENTO = /\b(PAGAMENTO|PGTO)\b.*\b(FATURA|EFETUADO|RECEBIDO)\b|^\s*PAGAMENTO\b/i;
const RE_ESTORNO   = /\b(ESTORNO|DEVOLUCAO|CANCELAMENTO|CREDITO\s+DE)\b/i;

/** Remove acento e normaliza espaço, para as expressões casarem sem surpresa. */
function normalizar(txt) {
  return (txt || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.234,56" -> 1234.56 ; "-500,00" -> -500 */
function paraNumero(bruto) {
  const limpo = String(bruto)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve o ano de uma data que veio só com dia e mês.
 *
 * A fatura cobre no máximo ~40 dias, então o ano é o da competência. A única
 * armadilha é a virada: fatura de janeiro com compra de dezembro. Quando o mês
 * da compra é maior que o da competência, é do ano anterior.
 */
function resolverAno(dia, mes, competencia) {
  const base = competencia || new Date();
  let ano = base.getUTCFullYear ? base.getUTCFullYear() : base.getFullYear();
  const mesBase = base.getUTCMonth ? base.getUTCMonth() + 1 : base.getMonth() + 1;
  if (mes > mesBase + 1) ano -= 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Extrai data, vencimento e total do cabeçalho, quando aparecem. */
function lerCabecalho(texto) {
  const t = normalizar(texto).toUpperCase();

  const venc = t.match(/VENCIMENTO[:\s]+(\d{2})\/(\d{2})\/(\d{2,4})/);
  const dataVencimento = venc
    ? new Date(Date.UTC(
        Number(venc[3].length === 2 ? '20' + venc[3] : venc[3]),
        Number(venc[2]) - 1, Number(venc[1])))
    : null;

  // Total: pega o primeiro que aparecer entre as formas usuais.
  const tot = t.match(/(?:TOTAL\s+(?:DA\s+)?FATURA|TOTAL\s+A\s+PAGAR|VALOR\s+TOTAL)[:\s]*R?\$?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/);
  const valorTotalInformado = tot ? paraNumero(tot[1]) : null;

  return { dataVencimento, valorTotalInformado };
}

/** Classifica a linha pelo texto e pelo sinal do valor. */
function classificar(descricao, valor) {
  if (RE_ENCARGO.test(descricao))   return 'encargo';
  if (RE_PAGAMENTO.test(descricao)) return 'pagamento';
  if (RE_ESTORNO.test(descricao))   return 'estorno';
  // Sem palavra-chave, o sinal decide: crédito na fatura é estorno.
  if (valor < 0) return 'estorno';
  return 'compra';
}

function extrair(texto, opcoes = {}) {
  const cabecalho = lerCabecalho(texto);
  const competencia = opcoes.competencia || cabecalho.dataVencimento || null;

  const linhas = [];
  const descartadas = [];

  for (const linhaBruta of String(texto).split(/\r?\n/)) {
    const linha = normalizar(linhaBruta);
    if (!linha) continue;

    // Data no começo. Sem data, não é lançamento.
    let dia, mes, anoExplicito = null, resto;
    const mNum = linha.match(RE_DATA_NUM);
    if (mNum) {
      dia = Number(mNum[1]); mes = Number(mNum[2]);
      if (mNum[3]) anoExplicito = Number(mNum[3].length === 2 ? '20' + mNum[3] : mNum[3]);
      resto = linha.slice(mNum[0].length);
    } else {
      const mAb = linha.match(RE_DATA_ABREV);
      if (!mAb) continue;
      dia = Number(mAb[1]);
      mes = MESES[mAb[2].toUpperCase()];
      if (!mes) continue;
      resto = linha.slice(mAb[0].length);
    }
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;

    // Valor no fim. Sem valor, não é lançamento.
    const mVal = resto.match(RE_VALOR_FIM);
    if (!mVal) continue;

    let valor = paraNumero(mVal[1]);
    if (valor === null) continue;
    // Marcação C/D de alguns emissores manda mais que o sinal.
    if (mVal[2] && mVal[2].toUpperCase() === 'C') valor = -Math.abs(valor);
    if (mVal[2] && mVal[2].toUpperCase() === 'D') valor = Math.abs(valor);

    const descricao = resto.slice(0, mVal.index).trim();
    if (!descricao) continue;

    // Descarte vem DEPOIS de confirmar data e valor: uma linha de total sem
    // data já foi ignorada acima, e uma compra com a palavra "vencimento" no
    // nome do estabelecimento não pode ser perdida por engano.
    if (RE_DESCARTE.test(descricao)) {
      descartadas.push(linha);
      continue;
    }

    const mParc = descricao.match(RE_PARCELA);
    const parcelaNumero = mParc ? Number(mParc[1]) : null;
    const parcelaTotal  = mParc ? Number(mParc[2]) : null;
    // Parcela precisa fazer sentido: 3/10 sim, 30/12 é data disfarçada.
    const parcelaValida = parcelaNumero && parcelaTotal &&
                          parcelaNumero <= parcelaTotal && parcelaTotal <= 72;

    const data = anoExplicito
      ? new Date(Date.UTC(anoExplicito, mes - 1, dia))
      : resolverAno(dia, mes, competencia);

    linhas.push({
      dataCompra: data,
      descricao,
      valor: Math.abs(valor),
      // O sinal vira tipo, e o valor fica sempre positivo, como no resto do
      // sistema (Transaction também guarda valor positivo e usa tipo).
      tipo: classificar(descricao, valor),
      parcelaNumero: parcelaValida ? parcelaNumero : null,
      parcelaTotal:  parcelaValida ? parcelaTotal  : null,
      ordem: linhas.length,
    });
  }

  return { cabecalho, linhas, descartadas };
}

/** Fallback: aceita qualquer coisa. Só é escolhido quando nenhum outro casa. */
function detectar() {
  return false;
}

module.exports = {
  nome: 'generico',
  rotulo: 'Genérico',
  detectar,
  extrair,
  // Expostos para teste.
  _internos: { normalizar, paraNumero, classificar, lerCabecalho, resolverAno },
};
