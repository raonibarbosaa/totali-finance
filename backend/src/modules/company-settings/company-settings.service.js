const prisma = require('../../config/database');
async function get(tenantId) {
  const t = await prisma.tenant.findUnique({ where:{ id:tenantId }, select:{id:true,razaoSocial:true,nomeFantasia:true,cnpj:true,codigoFilial:true,regime:true} });
  if (!t) throw { status:404, message:'Empresa não encontrada' };
  return t;
}
async function update(tenantId, data) {
  const { codigoFilial, regime } = data;
  return prisma.tenant.update({ where:{ id:tenantId }, data:{ ...(codigoFilial!==undefined&&{codigoFilial}), ...(regime!==undefined&&{regime}) }, select:{id:true,razaoSocial:true,nomeFantasia:true,cnpj:true,codigoFilial:true,regime:true} });
}
module.exports = { get, update };
