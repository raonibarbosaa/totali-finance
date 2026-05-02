const { PrismaClient } = require('@prisma/client');
const { sendNotification } = require('../notifications/notifications.service');
const prisma = new PrismaClient();

async function listPeriods(tenantId) {
  return prisma.period_closing.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { closer: { select: { name: true } }, reopener: { select: { name: true } } },
  });
}

async function getStatus(tenantId, year, month) {
  const record = await prisma.period_closing.findFirst({
    where: { tenant_id: tenantId, year: parseInt(year), month: parseInt(month) },
  });
  return { closed: !!record?.closed, record: record || null };
}

async function closePeriod(tenantId, userId, { year, month, notes }) {
  if (!year || !month) throw new Error('Ano e mês obrigatórios');

  const existing = await prisma.period_closing.findFirst({
    where: { tenant_id: tenantId, year: parseInt(year), month: parseInt(month) },
  });
  if (existing?.closed) throw new Error('Período já está fechado');

  const record = await prisma.period_closing.upsert({
    where: { tenant_id_year_month: { tenant_id: tenantId, year: parseInt(year), month: parseInt(month) } },
    update: { closed: true, closed_at: new Date(), closed_by: userId, notes: notes || null, reopened_at: null, reopened_by: null },
    create: {
      tenant_id: tenantId,
      year: parseInt(year),
      month: parseInt(month),
      closed: true,
      closed_at: new Date(),
      closed_by: userId,
      notes: notes || null,
    },
  });

  // Notifica o Admin Totali
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  await sendNotification({
    type: 'PERIOD_CLOSED',
    title: `Período fechado — ${tenant?.name}`,
    message: `${tenant?.name} fechou a competência ${String(month).padStart(2,'0')}/${year}.`,
    tenant_id: tenantId,
    target_role: 'ADMIN',
  });

  return record;
}

async function reopenPeriod(tenantId, userId, { year, month }) {
  const record = await prisma.period_closing.findFirst({
    where: { tenant_id: tenantId, year: parseInt(year), month: parseInt(month) },
  });
  if (!record?.closed) throw new Error('Período não está fechado');

  return prisma.period_closing.update({
    where: { id: record.id },
    data: { closed: false, reopened_at: new Date(), reopened_by: userId },
  });
}

/**
 * Verifica se uma data está em período fechado para o tenant
 * Usado pelo periodGuard middleware
 */
async function isPeriodClosed(tenantId, date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();

  const record = await prisma.period_closing.findFirst({
    where: { tenant_id: tenantId, year, month, closed: true },
  });
  return !!record;
}

module.exports = { listPeriods, getStatus, closePeriod, reopenPeriod, isPeriodClosed };
