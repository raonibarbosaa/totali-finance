const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(tenantId) {
  return prisma.stock_adjustment.findMany({
    where: { tenant_id: tenantId },
    orderBy: { date: 'desc' },
    take: 100,
  });
}

async function getCurrent(tenantId) {
  const latest = await prisma.stock_adjustment.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { date: 'desc' },
  });
  // Compras do mês atual ainda não consolidadas em ajuste
  const now = new Date();
  const purchases = await prisma.transaction.aggregate({
    where: {
      tenant_id: tenantId,
      status: { in: ['PAID', 'RECONCILED'] },
      date: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: now,
      },
      category: { is_merchandise: true },
    },
    _sum: { amount: true },
  });

  return {
    latest_adjustment: latest || null,
    latest_value: Number(latest?.value || 0),
    purchases_this_month: Number(purchases._sum.amount || 0),
  };
}

async function create(tenantId, userId, data) {
  const { date, value, notes, month, year } = data;
  if (!date)  throw new Error('Data obrigatória');
  if (value === undefined || value === null) throw new Error('Valor obrigatório');

  const d = new Date(date);
  return prisma.stock_adjustment.create({
    data: {
      tenant_id: tenantId,
      date: d,
      value: parseFloat(value),
      notes: notes || null,
      month: month || d.getMonth() + 1,
      year:  year  || d.getFullYear(),
      created_by: userId,
    },
  });
}

async function remove(id, tenantId) {
  const record = await prisma.stock_adjustment.findFirst({ where: { id, tenant_id: tenantId } });
  if (!record) throw new Error('Ajuste não encontrado');
  await prisma.stock_adjustment.delete({ where: { id } });
  return { ok: true };
}

module.exports = { list, getCurrent, create, remove };
