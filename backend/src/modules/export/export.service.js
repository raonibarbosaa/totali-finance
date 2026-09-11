const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Gera o arquivo TXT no layout do Domínio Contábil:
 * Data;CtoD;CtoC;Valor;Hist;Complemento;Filial;CCD;CCC
 */
// Ajuste de saldo NUNCA sai na exportação. Ele não é lançamento contábil: é um
// acerto interno do Finance contra o extrato. Na contabilidade, aquele período
// entra pelo extrato bancário completo, com os valores do banco.
//
// O filtro vale inclusive quando vêm transactionIds explícitos, senão daria
// para burlar pela seleção manual da tela.
const SEM_AJUSTE = { origem: { not: 'ajuste' } };

async function generateExport(tenantId, userId, { dateFrom, dateTo, transactionIds }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const filialCode = tenant?.codigoFilial || '1';

  const where = {
    tenantId,
    ...SEM_AJUSTE,
    ...(transactionIds?.length
      ? { id: { in: transactionIds } }
      : {
          dataLancamento: {
            gte: new Date(dateFrom + 'T00:00:00'),
            lte: new Date(dateTo   + 'T23:59:59'),
          },
        }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { dataLancamento: 'asc' },
  });

  // Filtra apenas os que têm conta débito e crédito (próprio ou da categoria)
  const exportaveis = transactions.filter(txn => {
    const ctoD = txn.contaDebito  || txn.category?.contaDebito;
    const ctoC = txn.contaCredito || txn.category?.contaCredito;
    return ctoD && ctoC;
  });

  // Quantos ficaram de fora por falta de conta de débito ou crédito. Antes o
  // descarte era silencioso: o usuário exportava e nunca sabia que faltou
  // lançamento no arquivo.
  const descartados = transactions.length - exportaveis.length;

  if (!exportaveis.length) {
    throw new Error(
      `Nenhum lançamento com codificação Domínio completa encontrado no período. ` +
      `${transactions.length} lançamento(s) foram encontrados, mas nenhum tem conta de débito e crédito.`
    );
  }

  const lines = [];
  for (const txn of exportaveis) {
    const date   = formatDate(txn.dataLancamento);
    const ctoD   = txn.contaDebito  || txn.category?.contaDebito  || '';
    const ctoC   = txn.contaCredito || txn.category?.contaCredito || '';
    const valor  = formatValue(txn.valor);
    const hist   = txn.codHistorico || txn.category?.codHistorico || '';
    const comp   = sanitize(txn.descricao) || '';
    const filial = filialCode;
    const ccd    = txn.centroCustoD || txn.category?.centroCustoD || '';
    const ccc    = txn.centroCustoC || txn.category?.centroCustoC || '';

    lines.push(`${date};${ctoD};${ctoC};${valor};${hist};${comp};${filial};${ccd};${ccc}`);
  }

  const content = lines.join('\n');
  const nomeArquivo = `dominio_${dateFrom}_${dateTo}.txt`;

  // Registra o log de exportação
  const exportLog = await prisma.exportLog.create({
    data: {
      tenantId,
      exportadoPor:   userId,
      periodoInicio:  new Date(dateFrom),
      periodoFim:     new Date(dateTo),
      totalRegistros: exportaveis.length,
      nomeArquivo,
    },
  });

  // Marca as transações como exportadas
  await prisma.transaction.updateMany({
    where: { id: { in: exportaveis.map(t => t.id) } },
    data:  { exportado: true },
  });

  return {
    exportId:      exportLog.id,
    totalRegistros: exportaveis.length,
    // Quantos do período NÃO entraram no arquivo por falta de codificação.
    // A tela avisa, em vez de deixar o usuário descobrir no Domínio.
    descartados,
    content,
    nomeArquivo,
  };
}

async function listExports(tenantId) {
  return prisma.exportLog.findMany({
    where: { tenantId },
    select: {
      id:             true,
      periodoInicio:  true,
      periodoFim:     true,
      totalRegistros: true,
      exportadoEm:    true,
      nomeArquivo:    true,
      exportador:     { select: { nome: true } },
    },
    orderBy: { exportadoEm: 'desc' },
    take: 50,
  });
}

async function downloadExport(id, tenantId) {
  const log = await prisma.exportLog.findFirst({ where: { id, tenantId } });
  if (!log) throw new Error('Exportação não encontrada');
  return log;
}

/**
 * Preview: lista lançamentos que seriam exportados, sem gravar
 */
async function previewExport(tenantId, { dateFrom, dateTo }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const filialCode = tenant?.codigoFilial || '1';

  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      ...SEM_AJUSTE,
      dataLancamento: {
        gte: new Date(dateFrom + 'T00:00:00'),
        lte: new Date(dateTo   + 'T23:59:59'),
      },
    },
    include: { category: true },
    orderBy: { dataLancamento: 'asc' },
  });

  return transactions.map(txn => {
    const ctoD = txn.contaDebito  || txn.category?.contaDebito;
    const ctoC = txn.contaCredito || txn.category?.contaCredito;
    return {
      id:            txn.id,
      data:          txn.dataLancamento,
      descricao:     txn.descricao,
      valor:         Number(txn.valor),
      tipo:          txn.tipo,
      categoria:     txn.category?.nome,
      contaDebito:   ctoD,
      contaCredito:  ctoC,
      historico:     txn.codHistorico || txn.category?.codHistorico,
      filial:        filialCode,
      centroCustoD:  txn.centroCustoD || txn.category?.centroCustoD,
      centroCustoC:  txn.centroCustoC || txn.category?.centroCustoC,
      exportado:     txn.exportado,
      pronto:        !!(ctoD && ctoC),
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  const dt  = new Date(d);
  const day = String(dt.getUTCDate()).padStart(2, '0');
  const mon = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yr  = dt.getUTCFullYear();
  return `${day}/${mon}/${yr}`;
}

function formatValue(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

function sanitize(str) {
  return (str || '').replace(/[;"\n\r]/g, ' ').trim().slice(0, 100);
}

module.exports = { generateExport, listExports, downloadExport, previewExport };
