const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Gera o arquivo TXT no layout do Domínio Contábil:
 * Data;CtoD;CtoC;Valor;Hist;Complemento;Filial;CCD;CCC
 */
async function generateExport(tenantId, userId, { dateFrom, dateTo, transactionIds }) {
  const settings = await prisma.company_settings.findFirst({ where: { tenant_id: tenantId } });
  const filialCode = settings?.dominio_filial_code || '1';

  // Monta o filtro
  const where = {
    tenant_id: tenantId,
    status: { in: ['PAID', 'RECONCILED'] },
    ...(transactionIds?.length
      ? { id: { in: transactionIds } }
      : {
          date: {
            gte: new Date(dateFrom + 'T00:00:00'),
            lte: new Date(dateTo   + 'T23:59:59'),
          },
        }),
    // Só exporta lançamentos com conta débito e crédito preenchidos
    dominio_conta_debito:  { not: null },
    dominio_conta_credito: { not: null },
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  if (!transactions.length) throw new Error('Nenhum lançamento encontrado para exportação no período selecionado');

  const lines = [];
  for (const txn of transactions) {
    const date  = formatDate(txn.date);
    const ctoD  = txn.dominio_conta_debito  || '';
    const ctoC  = txn.dominio_conta_credito || '';
    const valor = formatValue(txn.amount);
    const hist  = txn.dominio_historico     || '';
    const comp  = sanitize(txn.description) || '';
    const filial = txn.dominio_filial_override || filialCode;
    const ccd   = txn.dominio_centro_custo_d || '';
    const ccc   = txn.dominio_centro_custo_c || '';

    lines.push(`${date};${ctoD};${ctoC};${valor};${hist};${comp};${filial};${ccd};${ccc}`);
  }

  const content = lines.join('\n');

  // Registra o log de exportação
  const exportLog = await prisma.export_log.create({
    data: {
      tenant_id:      tenantId,
      exported_by:    userId,
      date_from:      new Date(dateFrom),
      date_to:        new Date(dateTo),
      total_records:  transactions.length,
      file_content:   content,
    },
  });

  // Marca as transações como exportadas
  await prisma.transaction.updateMany({
    where: { id: { in: transactions.map(t => t.id) } },
    data:  { exported: true, export_log_id: exportLog.id },
  });

  return {
    export_id: exportLog.id,
    total_records: transactions.length,
    content,
    filename: `dominio_${dateFrom}_${dateTo}.txt`,
  };
}

async function listExports(tenantId) {
  return prisma.export_log.findMany({
    where: { tenant_id: tenantId },
    select: {
      id: true,
      date_from: true,
      date_to: true,
      total_records: true,
      created_at: true,
      exporter: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
}

async function downloadExport(id, tenantId) {
  const log = await prisma.export_log.findFirst({ where: { id, tenant_id: tenantId } });
  if (!log) throw new Error('Exportação não encontrada');
  return log;
}

/**
 * Preview: lista lançamentos que seriam exportados, sem gravar
 */
async function previewExport(tenantId, { dateFrom, dateTo }) {
  const settings = await prisma.company_settings.findFirst({ where: { tenant_id: tenantId } });
  const filialCode = settings?.dominio_filial_code || '1';

  const transactions = await prisma.transaction.findMany({
    where: {
      tenant_id: tenantId,
      status: { in: ['PAID', 'RECONCILED'] },
      date: {
        gte: new Date(dateFrom + 'T00:00:00'),
        lte: new Date(dateTo   + 'T23:59:59'),
      },
    },
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  return transactions.map(txn => ({
    id:              txn.id,
    date:            txn.date,
    description:     txn.description,
    amount:          Number(txn.amount),
    category:        txn.category?.name,
    conta_debito:    txn.dominio_conta_debito,
    conta_credito:   txn.dominio_conta_credito,
    historico:       txn.dominio_historico,
    filial:          txn.dominio_filial_override || filialCode,
    centro_custo_d:  txn.dominio_centro_custo_d,
    centro_custo_c:  txn.dominio_centro_custo_c,
    exported:        txn.exported,
    ready:           !!(txn.dominio_conta_debito && txn.dominio_conta_credito),
  }));
}

// Helpers
function formatDate(d) {
  const dt = new Date(d);
  const day  = String(dt.getUTCDate()).padStart(2, '0');
  const mon  = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const year = dt.getUTCFullYear();
  return `${day}/${mon}/${year}`;
}

function formatValue(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

function sanitize(str) {
  return (str || '').replace(/[;"\n\r]/g, ' ').trim().slice(0, 100);
}

module.exports = { generateExport, listExports, downloadExport, previewExport };
