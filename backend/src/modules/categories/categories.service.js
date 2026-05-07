const prisma = require('../../config/database');
async function list(tenantId, opts = {}) {
  const { tipo, agrupadas } = opts;
  const where = { tenantId, ativo: true };
  if (tipo) where.tipo = tipo;
  const cats = await prisma.category.findMany({ where, orderBy: [{ tipo: "asc" }, { nome: "asc" }] });
  if (agrupadas === "true" || agrupadas === true) {
    return {
      receita: cats.filter(c => c.tipo === "receita"),
      despesa: cats.filter(c => c.tipo === "despesa"),
      transferencia: cats.filter(c => c.tipo === "transferencia"),
    };
  }
  return cats;
}
async function create(tenantId, data) {
  const { nome, tipo, natureza, contaDebito, contaCredito, codHistorico, centroCustoD, centroCustoC, flagMercadoria } = data;
  if (!nome) throw { status:400, message:'Nome obrigatório' };
  if (!tipo) throw { status:400, message:'Tipo obrigatório' };
  if (!natureza) throw { status:400, message:'Natureza obrigatória' };
  return prisma.category.create({ data:{ tenantId, nome, tipo, natureza, contaDebito:contaDebito||null, contaCredito:contaCredito||null, codHistorico:codHistorico||null, centroCustoD:centroCustoD||null, centroCustoC:centroCustoC||null, flagMercadoria:!!flagMercadoria } });
}
async function update(id, tenantId, data) {
  const r = await prisma.category.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Categoria não encontrada' };
  return prisma.category.update({ where:{ id }, data });
}
async function remove(id, tenantId) {
  const r = await prisma.category.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Categoria não encontrada' };
  await prisma.category.update({ where:{ id }, data:{ ativo:false } });
  return { ok:true };
}
module.exports = { list, create, update, remove };
