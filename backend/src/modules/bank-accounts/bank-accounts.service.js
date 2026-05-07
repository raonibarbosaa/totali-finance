const prisma = require('../../config/database');

// Status considerados como "movimentação efetivada" para fins de saldo.
// Mesma regra usada em getBalance(id).
const STATUS_EFETIVADOS = ['realizado', 'conciliado'];

/**
 * Calcula o saldoAtual para uma lista de contas bancárias.
 *
 * Faz uma única query groupBy no banco (em vez de N queries — uma por conta),
 * agregando receitas e despesas por bankAccountId. Em seguida, para cada conta
 * da lista, soma:
 *
 *   saldoAtual = saldoInicial + receitas - despesas
 *
 * Retorna a mesma lista de contas, com o campo `saldoAtual` adicionado em cada item.
 */
async function withSaldoAtual(tenantId, accounts) {
  if (!accounts || accounts.length === 0) return accounts;

  const ids = accounts.map((a) => a.id);

  // Uma única query: agrega valor por bankAccountId + tipo
  const grupos = await prisma.transaction.groupBy({
    by: ['bankAccountId', 'tipo'],
    where: {
      tenantId,
      bankAccountId: { in: ids },
      tipo: { in: ['receita', 'despesa'] },
      status: { in: STATUS_EFETIVADOS },
    },
    _sum: { valor: true },
  });

  // Indexa por bankAccountId para lookup O(1) por conta
  const porConta = {};
  for (const g of grupos) {
    if (!g.bankAccountId) continue;
    if (!porConta[g.bankAccountId]) porConta[g.bankAccountId] = { receita: 0, despesa: 0 };
    porConta[g.bankAccountId][g.tipo] = Number(g._sum.valor || 0);
  }

  return accounts.map((a) => {
    const totais = porConta[a.id] || { receita: 0, despesa: 0 };
    const saldoAtual = Number(a.saldoInicial) + totais.receita - totais.despesa;
    return { ...a, saldoAtual };
  });
}

async function list(tenantId) {
  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId, ativo: true },
    orderBy: { nome: 'asc' },
  });
  return withSaldoAtual(tenantId, accounts);
}

async function findOne(id, tenantId) {
  const r = await prisma.bankAccount.findFirst({ where: { id, tenantId } });
  if (!r) throw { status: 404, message: 'Conta não encontrada' };
  const [comSaldo] = await withSaldoAtual(tenantId, [r]);
  return comSaldo;
}

async function create(tenantId, data) {
  const { nome, banco, agencia, conta, tipo, saldoInicial, dataSaldoInicial } = data;
  if (!nome) throw { status: 400, message: 'Nome obrigatório' };
  if (!tipo) throw { status: 400, message: 'Tipo obrigatório' };
  return prisma.bankAccount.create({
    data: {
      tenantId,
      nome,
      banco: banco || null,
      agencia: agencia || null,
      conta: conta || null,
      tipo,
      saldoInicial: parseFloat(saldoInicial || 0),
      dataSaldoInicial: dataSaldoInicial ? new Date(dataSaldoInicial) : null,
    },
  });
}

async function update(id, tenantId, data) {
  await findOne(id, tenantId);
  const sanitized = {
    ...data,
    ...(data.saldoInicial !== undefined && { saldoInicial: parseFloat(data.saldoInicial || 0) }),
    ...(data.dataSaldoInicial !== undefined && { dataSaldoInicial: data.dataSaldoInicial ? new Date(data.dataSaldoInicial) : null }),
  };
  return prisma.bankAccount.update({ where: { id }, data: sanitized });
}

async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.bankAccount.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

async function getBalance(id, tenantId) {
  const account = await prisma.bankAccount.findFirst({ where: { id, tenantId } });
  if (!account) throw { status: 404, message: 'Conta não encontrada' };

  const inc = await prisma.transaction.aggregate({
    where: {
      tenantId,
      bankAccountId: id,
      tipo: 'receita',
      status: { in: STATUS_EFETIVADOS },
    },
    _sum: { valor: true },
  });
  const dec = await prisma.transaction.aggregate({
    where: {
      tenantId,
      bankAccountId: id,
      tipo: 'despesa',
      status: { in: STATUS_EFETIVADOS },
    },
    _sum: { valor: true },
  });

  const saldoAtual =
    Number(account.saldoInicial) + Number(inc._sum.valor || 0) - Number(dec._sum.valor || 0);
  return { ...account, saldoAtual };
}

module.exports = { list, findOne, create, update, remove, getBalance };
