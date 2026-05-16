const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function competenciaDate(year, month) {
  return new Date(parseInt(year), parseInt(month) - 1, 1);
}

async function listPeriods(tenantId) {
  return prisma.periodClosing.findMany({
    where: { tenantId },
    orderBy: { competencia: 'desc' },
    include: {
      fechador: { select: { nome: true } },
      reabrid:  { select: { nome: true } },
    },
  });
}

async function getStatus(tenantId, year, month) {
  const record = await prisma.periodClosing.findFirst({
    where: { tenantId, competencia: competenciaDate(year, month) },
  });
  return { closed: record?.status === 'fechado', record: record || null };
}

async function closePeriod(tenantId, userId, { year, month, notes }) {
  if (!year || !month) throw new Error('Ano e mês obrigatórios');
  const competencia = competenciaDate(year, month);

  const existing = await prisma.periodClosing.findFirst({ where: { tenantId, competencia } });
  if (existing?.status === 'fechado') throw new Error('Período já está fechado');

  const record = await prisma.periodClosing.upsert({
    where:  { tenantId_competencia: { tenantId, competencia } },
    update: { status: 'fechado', fechadoEm: new Date(), fechadoPor: userId, reabertoEm: null, reabertoP: null },
    create: { tenantId, competencia, status: 'fechado', fechadoEm: new Date(), fechadoPor: userId },
  });

  return record;
}

async function reopenPeriod(tenantId, userId, { year, month }) {
  const competencia = competenciaDate(year, month);
  const record = await prisma.periodClosing.findFirst({ where: { tenantId, competencia } });
  if (record?.status !== 'fechado') throw new Error('Período não está fechado');

  return prisma.periodClosing.update({
    where: { id: record.id },
    data:  { status: 'aberto', reabertoEm: new Date(), reabertoP: userId },
  });
}

async function isPeriodClosed(tenantId, date) {
  const d = new Date(date);
  const competencia = new Date(d.getFullYear(), d.getMonth(), 1);
  const record = await prisma.periodClosing.findFirst({
    where: { tenantId, competencia, status: 'fechado' },
  });
  return !!record;
}

module.exports = { listPeriods, getStatus, closePeriod, reopenPeriod, isPeriodClosed };
