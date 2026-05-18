const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function competenciaDate(year, month) {
  return new Date(parseInt(year), parseInt(month) - 1, 1);
}

async function getDashboardData() {
  const tenants = await prisma.tenant.findMany({
    where:   { ativo: true },
    include: {
      userRoles:      { select: { userId: true } },
      periodClosings: { orderBy: { competencia: 'desc' }, take: 1 },
    },
    orderBy: { razaoSocial: 'asc' },
  });

  const now          = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();
  const competencia  = competenciaDate(currentYear, currentMonth);

  const results = await Promise.all(tenants.map(async (tenant) => {
    // Período atual fechado?
    const currentPeriod = await prisma.periodClosing.findFirst({
      where: { tenantId: tenant.id, competencia },
    });

    // Títulos vencidos em aberto
    const overdueCount = await prisma.title.count({
      where: {
        tenantId:        tenant.id,
        status:          'aberto',
        dataVencimento:  { lt: new Date() },
      },
    }).catch(() => 0);

    // OFX não conciliados
    const ofxPending = await prisma.ofxEntry.count({
      where: { tenantId: tenant.id, transactionId: null },
    }).catch(() => 0);

    // Última exportação
    const lastExport = await prisma.exportLog.findFirst({
      where:   { tenantId: tenant.id },
      orderBy: { exportadoEm: 'desc' },
      select:  { exportadoEm: true },
    }).catch(() => null);

    // Último login (usa o RefreshToken mais recente de qualquer usuário do tenant)
    const userIds = tenant.userRoles.map(r => r.userId);
    const lastLoginRow = userIds.length === 0 ? null : await prisma.refreshToken.findFirst({
      where:   { userId: { in: userIds } },
      orderBy: { criadoEm: 'desc' },
      select:  { criadoEm: true },
    }).catch(() => null);

    const nome = tenant.nomeFantasia || tenant.razaoSocial;

    return {
      id:            tenant.id,
      name:          nome,
      cnpj:          tenant.cnpj,
      ativo:         tenant.ativo,
      user_count:    tenant.userRoles.length,
      period_closed: currentPeriod?.status === 'fechado',
      period_month:  currentMonth,
      period_year:   currentYear,
      overdue_count: overdueCount,
      ofx_pending:   ofxPending,
      last_export:   lastExport?.exportadoEm || null,
      last_login:    lastLoginRow?.criadoEm || null,
    };
  }));

  return {
    summary: {
      totalTenants:   results.length,
      closedCount:    results.filter(r => r.period_closed).length,
      withOverdue:    results.filter(r => r.overdue_count > 0).length,
      withOFXPending: results.filter(r => r.ofx_pending > 0).length,
    },
    clients: results,
  };
}

async function getClientDetail(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Cliente não encontrado');

  const periods = await prisma.periodClosing.findMany({
    where:   { tenantId },
    orderBy: { competencia: 'desc' },
    take:    12,
  });

  const exports = await prisma.exportLog.findMany({
    where:   { tenantId },
    orderBy: { exportadoEm: 'desc' },
    take:    10,
    select:  { id: true, periodoInicio: true, periodoFim: true, totalRegistros: true, exportadoEm: true },
  });

  const userRoles = await prisma.userTenantRole.findMany({
    where:   { tenantId },
    include: { user: { select: { id: true, nome: true, email: true } } },
  });

  return {
    tenant,
    periods,
    exports,
    users: userRoles.map(r => ({ ...r.user, role: r.role })),
  };
}


async function getOfxPending(tenantId, limit = 50) {
  const entries = await prisma.ofxEntry.findMany({
    where:   { tenantId, transactionId: null },
    orderBy: { dataMovimento: 'desc' },
    take:    limit,
    include: { bankAccount: { select: { conta: true } } },
  });
  const total = await prisma.ofxEntry.count({
    where: { tenantId, transactionId: null },
  });
  return {
    total,
    entries: entries.map(e => ({
      id:        e.id,
      data:      e.dataMovimento,
      valor:     e.valor,
      tipo:      e.tipo,
      descricao: e.descricao || e.memo || '—',
      conta:     e.bankAccount?.conta || '',
    })),
  };
}

module.exports = { getDashboardData, getClientDetail, getOfxPending };
