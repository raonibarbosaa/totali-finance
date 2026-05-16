const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(tenantId) {
  return prisma.stockAdjustment.findMany({
    where: { tenantId },
    orderBy: { competencia: 'desc' },
    take: 100,
  });
}

async function getCurrent(tenantId) {
  const latest = await prisma.stockAdjustment.findFirst({
    where: { tenantId },
    orderBy: { competencia: 'desc' },
  });

  const now = new Date();
  const purchases = await prisma.transaction.aggregate({
    where: {
      tenantId,
      dataLancamento: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: now,
      },
      category: { is: { flagMercadoria: true } },
    },
    _sum: { valor: true },
  });

  return {
    latestAdjustment:   latest || null,
    latestValue:        Number(latest?.valorEstoque || 0),
    purchasesThisMonth: Number(purchases._sum.valor || 0),
  };
}

async function create(tenantId, userId, data) {
  const { date, value, notes } = data;
  if (!date)  throw new Error('Data obrigatória');
  if (value === undefined || value === null) throw new Error('Valor obrigatório');

  return prisma.stockAdjustment.create({
    data: {
      tenantId,
      competencia:  new Date(date),
      valorEstoque: parseFloat(value),
      observacao:   notes || null,
      criadoPor:    userId,
    },
  });
}

async function remove(id, tenantId) {
  const record = await prisma.stockAdjustment.findFirst({ where: { id, tenantId } });
  if (!record) throw new Error('Ajuste não encontrado');
  await prisma.stockAdjustment.delete({ where: { id } });
  return { ok: true };
}

module.exports = { list, getCurrent, create, remove };
