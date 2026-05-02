const prisma = require('../../config/database');
async function list(tenantId, filters={}) {
  const { tipo, status, bankAccountId, categoryId, search, dateFrom, dateTo, page=1, limit=50 } = filters;
  const skip = (page-1)*parseInt(limit);
  const where = { tenantId, ...(tipo&&{tipo}), ...(status&&{status}), ...(bankAccountId&&{bankAccountId}), ...(categoryId&&{categoryId}), ...(dateFrom||dateTo?{dataLancamento:{...(dateFrom&&{gte:new Date(dateFrom)}), ...(dateTo&&{lte:new Date(dateTo+"T23:59:59")})}}:{}), ...(search&&{OR:[{descricao:{contains:search,mode:"insensitive"}},{complemento:{contains:search,mode:"insensitive"}}]}) };
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({ where, include:{ category:{select:{id:true,nome:true}}, bankAccount:{select:{id:true,nome:true}} }, orderBy:{ dataLancamento:"desc" }, skip, take:parseInt(limit) }),
    prisma.transaction.count({ where }),
  ]);
  return { data, total, page:parseInt(page), totalPages:Math.ceil(total/parseInt(limit)) };
}
async function create(tenantId, userId, data) {
  const { tipo, descricao, valor, dataLancamento, dataCompetencia, bankAccountId, categoryId, complemento, status } = data;
  if (!tipo) throw { status:400, message:"Tipo obrigatório" };
  if (!descricao) throw { status:400, message:"Descrição obrigatória" };
  if (!valor||valor<=0) throw { status:400, message:"Valor inválido" };
  if (!dataLancamento) throw { status:400, message:"Data obrigatória" };
  let df = {};
  if (categoryId) {
    const cat = await prisma.category.findFirst({ where:{ id:categoryId, tenantId } });
    if (cat) df = { contaDebito:cat.contaDebito, contaCredito:cat.contaCredito, codHistorico:cat.codHistorico, centroCustoD:cat.centroCustoD, centroCustoC:cat.centroCustoC };
  }
  return prisma.transaction.create({ data:{ tenantId, tipo, descricao, valor:parseFloat(valor), dataLancamento:new Date(dataLancamento), dataCompetencia:dataCompetencia?new Date(dataCompetencia):new Date(dataLancamento), bankAccountId:bankAccountId||null, categoryId:categoryId||null, complemento:complemento||null, status:status||"realizado", origem:"manual", criadoPor:userId, ...df }, include:{category:true,bankAccount:true} });
}
async function update(id, tenantId, data) {
  const r = await prisma.transaction.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:"Lançamento não encontrado" };
  if (r.exportado) throw { status:400, message:"Lançamento exportado não pode ser editado" };
  return prisma.transaction.update({ where:{id}, data, include:{category:true,bankAccount:true} });
}
async function remove(id, tenantId) {
  const r = await prisma.transaction.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:"Lançamento não encontrado" };
  if (r.exportado) throw { status:400, message:"Lançamento exportado não pode ser excluído" };
  await prisma.transaction.delete({ where:{id} });
  return { ok:true };
}
module.exports = { list, create, update, remove };
