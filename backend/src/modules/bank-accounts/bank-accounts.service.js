const prisma = require('../../config/database');
async function list(tenantId) {
  return prisma.bankAccount.findMany({ where:{ tenantId, ativo:true }, orderBy:{ nome:'asc' } });
}
async function findOne(id, tenantId) {
  const r = await prisma.bankAccount.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Conta não encontrada' };
  return r;
}
async function create(tenantId, data) {
  const { nome, banco, agencia, conta, tipo, saldoInicial, dataSaldoInicial } = data;
  if (!nome) throw { status:400, message:'Nome obrigatório' };
  if (!tipo) throw { status:400, message:'Tipo obrigatório' };
  return prisma.bankAccount.create({ data:{ tenantId, nome, banco:banco||null, agencia:agencia||null, conta:conta||null, tipo, saldoInicial:parseFloat(saldoInicial||0), dataSaldoInicial:dataSaldoInicial?new Date(dataSaldoInicial):null } });
}
async function update(id, tenantId, data) {
  await findOne(id, tenantId);
  return prisma.bankAccount.update({ where:{ id }, data });
}
async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.bankAccount.update({ where:{ id }, data:{ ativo:false } });
  return { ok:true };
}
async function getBalance(id, tenantId) {
  const account = await findOne(id, tenantId);
  const inc = await prisma.transaction.aggregate({ where:{ tenantId, bankAccountId:id, tipo:'receita', status:{ in:['realizado','conciliado'] } }, _sum:{ valor:true } });
  const dec = await prisma.transaction.aggregate({ where:{ tenantId, bankAccountId:id, tipo:'despesa', status:{ in:['realizado','conciliado'] } }, _sum:{ valor:true } });
  const saldoAtual = Number(account.saldoInicial) + Number(inc._sum.valor||0) - Number(dec._sum.valor||0);
  return { ...account, saldoAtual };
}
module.exports = { list, findOne, create, update, remove, getBalance };
