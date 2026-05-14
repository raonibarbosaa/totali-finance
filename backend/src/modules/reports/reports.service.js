const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildDateRange(year, month) {
  if (month) {
    const y = parseInt(year);
    const m = parseInt(month);
    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 1);
    return { gte: start, lt: end };
  }
  const y = parseInt(year);
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

function fmt(n) {
  return Math.round((n || 0) * 100) / 100;
}

// ─── DRE ─────────────────────────────────────────────────────────────────────

/**
 * getDRE — Demonstração do Resultado do Exercício
 *
 * Estrutura:
 *   (+) Receita Bruta
 *   (−) CMV  (compras de mercadoria marcadas com flagMercadoria)
 *   (=) Lucro Bruto
 *   (−) Despesas Operacionais  (subtipo OPERACIONAL)
 *   (=) Resultado Operacional
 *   (−) Distribuição de Lucros (subtipo DISTRIBUICAO_LUCROS)
 *   (=) Resultado Líquido
 *
 * Regimes:
 *   CASH        → usa data da transação (transaction.data) + status pago
 *   COMPETENCIA → usa competenceYear/competenceMonth da transação
 */
async function getDRE(tenantId, { year, month, regime = 'CASH' }) {
  const reg = regime.toUpperCase() === 'COMPETENCIA' ? 'COMPETENCIA' : 'CASH';

  // Filtro base de transações
  let where;
  if (reg === 'CASH') {
    where = {
      tenantId,
      dataLancamento: buildDateRange(year, month),
    };
  } else {
    where = {
      tenantId,
      dataCompetencia: buildDateRange(year, month),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { dataLancamento: 'asc' },
  });

  // Acumuladores
  let totalReceita       = 0;
  let totalCMV           = 0;
  let totalOpDespesa     = 0;
  let totalDistLucros    = 0;

  const receitaMap   = {};
  const cmvMap       = {};
  const opDespMap    = {};
  const distMap      = {};

  for (const txn of transactions) {
    const cat    = txn.category;
    const valor  = Math.abs(Number(txn.valor ?? txn.amount ?? 0));
    const tipo   = txn.tipo ?? txn.type ?? '';
    const catNome = cat?.nome ?? cat?.name ?? 'Sem Categoria';

    const isReceita  = tipo === 'receita'  || tipo === 'INCOME';
    const isPagar    = tipo === 'despesa'    || tipo === 'EXPENSE';
    const isMerc     = cat?.flagMercadoria ?? cat?.is_merchandise ?? false;
    const subtipo    = cat?.subtipo ?? 'OPERACIONAL';
    const isDistLucros = subtipo === 'DISTRIBUICAO_LUCROS';

    if (isReceita) {
      receitaMap[catNome] = (receitaMap[catNome] || 0) + valor;
      totalReceita += valor;
    } else if (isPagar) {
      if (isMerc) {
        cmvMap[catNome] = (cmvMap[catNome] || 0) + valor;
        totalCMV += valor;
      } else if (isDistLucros) {
        distMap[catNome] = (distMap[catNome] || 0) + valor;
        totalDistLucros += valor;
      } else {
        opDespMap[catNome] = (opDespMap[catNome] || 0) + valor;
        totalOpDespesa += valor;
      }
    }
  }

  const lucroBruto       = totalReceita - totalCMV;
  const resultadoOp      = lucroBruto - totalOpDespesa;
  const resultadoLiquido = resultadoOp - totalDistLucros;

  const toBreakdown = (map, total) =>
    Object.entries(map)
      .map(([nome, valor]) => ({
        nome,
        valor: fmt(valor),
        percentual: total > 0 ? fmt((valor / totalReceita) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

  return {
    regime: reg,
    periodo: { year: parseInt(year), month: month ? parseInt(month) : null },
    receita: {
      total: fmt(totalReceita),
      itens: toBreakdown(receitaMap, totalReceita),
    },
    cmv: {
      total: fmt(totalCMV),
      itens: toBreakdown(cmvMap, totalCMV),
    },
    lucroBruto: fmt(lucroBruto),
    despesasOperacionais: {
      total: fmt(totalOpDespesa),
      itens: toBreakdown(opDespMap, totalOpDespesa),
    },
    resultadoOperacional: fmt(resultadoOp),
    distribuicaoLucros: {
      total: fmt(totalDistLucros),
      itens: toBreakdown(distMap, totalDistLucros),
    },
    resultadoLiquido: fmt(resultadoLiquido),
    totalTransacoes: transactions.length,
  };
}

// ─── DFC ─────────────────────────────────────────────────────────────────────

/**
 * getDFC — Demonstração dos Fluxos de Caixa
 *
 * Agrupa por dfcType da categoria:
 *   OPERACIONAL   → atividades operacionais (padrão)
 *   INVESTIMENTO  → compra/venda de ativos
 *   FINANCIAMENTO → empréstimos, aportes de capital, distribuição de lucros
 *
 * Também detalha fluxo por conta bancária.
 */
async function getDFC(tenantId, { year, month }) {
  const where = {
    tenantId,
    dataLancamento: buildDateRange(year, month),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true, bankAccount: true },
    orderBy: { dataLancamento: 'asc' },
  });

  // Agrupa por dfcType
  const grupos = {
    OPERACIONAL:   { entradas: 0, saidas: 0, itens: [] },
    INVESTIMENTO:  { entradas: 0, saidas: 0, itens: [] },
    FINANCIAMENTO: { entradas: 0, saidas: 0, itens: [] },
  };

  // Agrupa por conta bancária
  const contasMap = {};

  for (const txn of transactions) {
    const cat     = txn.category;
    const valor   = Math.abs(Number(txn.valor ?? txn.amount ?? 0));
    const tipo    = txn.tipo ?? txn.type ?? '';
    const dfcType = cat?.dfcType ?? cat?.dfc_type ?? 'OPERACIONAL';
    const grupo   = grupos[dfcType] ?? grupos.OPERACIONAL;

    const isEntrada = tipo === 'receita' || tipo === 'INCOME';

    if (isEntrada) {
      grupo.entradas += valor;
    } else {
      grupo.saidas += valor;
    }

    grupo.itens.push({
      data: txn.dataLancamento ? new Date(txn.dataLancamento).toISOString().split('T')[0] : null,
      descricao: txn.descricao ?? txn.description ?? '',
      categoria: cat?.nome ?? cat?.name ?? 'Sem Categoria',
      valor: isEntrada ? fmt(valor) : fmt(-valor),
      tipo: isEntrada ? 'entrada' : 'saida',
    });

    // Por conta bancária
    const contaId   = txn.bankAccountId ?? txn.bankAccountId ?? 'sem-conta';
    const contaNome = txn.bankAccount?.nome ?? txn.bankAccount?.name ?? 'Sem Conta';
    if (!contasMap[contaId]) {
      contasMap[contaId] = { id: contaId, nome: contaNome, entradas: 0, saidas: 0 };
    }
    if (isEntrada) {
      contasMap[contaId].entradas += valor;
    } else {
      contasMap[contaId].saidas += valor;
    }
  }

  // Consolida grupos
  const gruposConsolidados = Object.entries(grupos).map(([tipo, g]) => ({
    tipo,
    label: { OPERACIONAL: 'Atividades Operacionais', INVESTIMENTO: 'Atividades de Investimento', FINANCIAMENTO: 'Atividades de Financiamento' }[tipo],
    entradas:  fmt(g.entradas),
    saidas:    fmt(g.saidas),
    liquido:   fmt(g.entradas - g.saidas),
    itens:     g.itens,
  }));

  const totalEntradas = gruposConsolidados.reduce((s, g) => s + g.entradas, 0);
  const totalSaidas   = gruposConsolidados.reduce((s, g) => s + g.saidas,   0);
  const fluxoLiquido  = totalEntradas - totalSaidas;

  const contas = Object.values(contasMap).map(c => ({
    ...c,
    entradas: fmt(c.entradas),
    saidas:   fmt(c.saidas),
    liquido:  fmt(c.entradas - c.saidas),
  }));

  return {
    periodo: { year: parseInt(year), month: month ? parseInt(month) : null },
    grupos: gruposConsolidados,
    totalEntradas: fmt(totalEntradas),
    totalSaidas:   fmt(totalSaidas),
    fluxoLiquido:  fmt(fluxoLiquido),
    porConta:      contas,
    totalTransacoes: transactions.length,
  };
}

// ─── Comparativo Mensal ───────────────────────────────────────────────────────

/**
 * getMonthlyComparison — Evolução mensal do ano
 * Retorna receita, despesa e resultado para cada mês do ano.
 */
async function getMonthlyComparison(tenantId, { year, regime = 'CASH' }) {
  const reg = regime.toUpperCase() === 'COMPETENCIA' ? 'COMPETENCIA' : 'CASH';
  const meses = [];

  for (let m = 1; m <= 12; m++) {
    const dre = await getDRE(tenantId, { year, month: String(m), regime: reg });
    meses.push({
      mes: m,
      nomeMes: new Date(parseInt(year), m - 1, 1).toLocaleString('pt-BR', { month: 'short' }),
      receita:            dre.receita.total,
      despesasOp:         dre.despesasOperacionais.total,
      cmv:                dre.cmv.total,
      distribuicaoLucros: dre.distribuicaoLucros.total,
      resultadoLiquido:   dre.resultadoLiquido,
    });
  }

  return { year: parseInt(year), regime: reg, meses };
}

module.exports = { getDRE, getDFC, getMonthlyComparison };
