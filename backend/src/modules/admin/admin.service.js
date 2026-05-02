const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getDashboardData() {
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    include: {
      users: { select: { id: true } },
      period_closings: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();

  const results = await Promise.all(tenants.map(async (tenant) => {
    // Período atual fechado?
    const currentPeriod = await prisma.period_closing.findFirst({
      where: { tenant_id: tenant.id, year: currentYear, month: currentMonth },
    });

    // Último acesso
    const lastUser = await prisma.user.findFirst({
      where: { tenant_users: { some: { tenant_id: tenant.id } } },
      orderBy: { updated_at: 'desc' },
      select: { last_login: true, name: true },
    });

    // Lançamentos pendentes (títulos vencidos em aberto)
    const overdueCount = await prisma.payable_receivable.count({
      where: {
        tenant_id: tenant.id,
        status: { in: ['OPEN', 'PARTIAL'] },
        due_date: { lt: new Date() },
      },
    });

    // OFX pendentes
    const ofxPending = await prisma.ofx_import_item.count({
      where: { tenant_id: tenant.id, status: 'PENDING' },
    });

    // Última exportação
    const lastExport = await prisma.export_log.findFirst({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    return {
      id:            tenant.id,
      name:          tenant.name,
      cnpj:          tenant.cnpj,
      active:        tenant.active,
      user_count:    tenant.users.length,
      period_closed: currentPeriod?.closed || false,
      period_month:  currentMonth,
      period_year:   currentYear,
      last_login:    lastUser?.last_login || null,
      overdue_count: overdueCount,
      ofx_pending:   ofxPending,
      last_export:   lastExport?.created_at || null,
    };
  }));

  const totalTenants  = results.length;
  const closedCount   = results.filter(r => r.period_closed).length;
  const withOverdue   = results.filter(r => r.overdue_count > 0).length;
  const withOFXPending = results.filter(r => r.ofx_pending > 0).length;

  return {
    summary: { totalTenants, closedCount, withOverdue, withOFXPending },
    clients: results,
  };
}

async function getClientDetail(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Cliente não encontrado');

  const periods = await prisma.period_closing.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 12,
  });

  const exports = await prisma.export_log.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: { id: true, date_from: true, date_to: true, total_records: true, created_at: true },
  });

  const users = await prisma.user.findMany({
    where: { tenant_users: { some: { tenant_id: tenantId } } },
    select: { id: true, name: true, email: true, last_login: true,
      tenant_users: { where: { tenant_id: tenantId }, select: { role: true } } },
  });

  return { tenant, periods, exports, users };
}

module.exports = { getDashboardData, getClientDetail };
