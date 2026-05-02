const prisma = require('../../config/database');
async function list(tenantId) {
  return prisma.ofxPattern.findMany({ where:{ tenantId, ativo:true }, include:{ category:{select:{id:true,nome:true}} }, orderBy:{ textoHistorico:'asc' } });
}
async function create(tenantId, data) {
  const { textoHistorico, categoryId, complementoAuto } = data;
  if (!textoHistorico) throw { status:400, message:'Texto do histórico obrigatório' };
  return prisma.ofxPattern.create({ data:{ tenantId, textoHistorico, categoryId:categoryId||null, complementoAuto:complementoAuto||null }, include:{category:true} });
}
async function update(id, tenantId, data) {
  const r = await prisma.ofxPattern.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Padrão não encontrado' };
  return prisma.ofxPattern.update({ where:{id}, data, include:{category:true} });
}
async function remove(id, tenantId) {
  const r = await prisma.ofxPattern.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Padrão não encontrado' };
  await prisma.ofxPattern.update({ where:{id}, data:{ativo:false} });
  return { ok:true };
}
module.exports = { list, create, update, remove };
