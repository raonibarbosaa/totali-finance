// backend/src/modules/notifications/bills.scheduler.js
// Notifica diariamente sobre contas a pagar vencendo no dia.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HOUR_TO_RUN = 8;  // 8h da manhã

let lastRunDate = null; // YYYY-MM-DD da última execução

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatBRL(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function runDailyCheck() {
  const today = todayKey();
  if (lastRunDate === today) return; // já rodou hoje
  lastRunDate = today;

  console.log('[BillsScheduler] Verificando contas a pagar do dia...', new Date().toISOString());

  const tenants = await prisma.tenant.findMany({
    where:  { ativo: true },
    select: { id: true, nomeFantasia: true, razaoSocial: true },
  });

  for (const t of tenants) {
    try {
      const titles = await prisma.title.findMany({
        where: {
          tenantId:       t.id,
          tipo:           'pagar',
          status:         'aberto',
          dataVencimento: { gte: startOfDay(), lte: endOfDay() },
        },
        select: { id: true, descricao: true, valor: true },
      });

      if (titles.length === 0) continue;

      const total = titles.reduce((s, x) => s + Number(x.valor || 0), 0);
      const titulo = titles.length === 1
        ? '1 conta vencendo hoje'
        : `${titles.length} contas vencendo hoje`;

      const exemplos = titles.slice(0, 3).map(x => x.descricao).join(', ');
      const sufixo   = titles.length > 3 ? ` e mais ${titles.length - 3}` : '';

      const mensagem = `Total ${formatBRL(total)} — ${exemplos}${sufixo}.`;

      await prisma.notification.create({
        data: {
          tenantId: t.id,
          tipo:     'bills_due_today',
          titulo,
          mensagem,
          lida:     false,
        },
      });

      console.log(`[BillsScheduler] ✅ Tenant ${t.nomeFantasia || t.razaoSocial}: ${titles.length} contas, total ${formatBRL(total)}`);
    } catch (e) {
      console.error(`[BillsScheduler] Erro tenant ${t.id}:`, e.message);
    }
  }
}

// Verifica a cada 10 minutos se já passou da hora — só dispara 1x por dia
function startScheduler() {
  console.log(`[BillsScheduler] Iniciado — executará diariamente às ${HOUR_TO_RUN}h`);

  async function tick() {
    const now = new Date();
    if (now.getHours() >= HOUR_TO_RUN) {
      await runDailyCheck().catch(e => console.error('[BillsScheduler]', e));
    }
  }

  tick(); // tenta rodar imediatamente
  setInterval(tick, 10 * 60 * 1000); // a cada 10 min
}

module.exports = { startScheduler, runDailyCheck };
