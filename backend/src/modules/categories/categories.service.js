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
  const { nome, tipo, natureza, subtipo, contaDebito, contaCredito, codHistorico, centroCustoD, centroCustoC, flagMercadoria } = data;
  if (!nome) throw { status:400, message:'Nome obrigatório' };
  if (!tipo) throw { status:400, message:'Tipo obrigatório' };
  if (!natureza) throw { status:400, message:'Natureza obrigatória' };
  // Subtipo só se aplica a despesa. Receita/transferência ficam sempre 'operacional'.
  const subtipoFinal = (tipo === 'despesa' && subtipo === 'distribuicao_lucros')
    ? 'distribuicao_lucros'
    : 'operacional';
  return prisma.category.create({ data:{ tenantId, nome, tipo, natureza, subtipo: subtipoFinal, contaDebito:contaDebito||null, contaCredito:contaCredito||null, codHistorico:codHistorico||null, centroCustoD:centroCustoD||null, centroCustoC:centroCustoC||null, flagMercadoria:!!flagMercadoria } });
}
async function update(id, tenantId, data) {
  const r = await prisma.category.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Categoria não encontrada' };

  // Categoria de sistema (ajuste de saldo): as contas contábeis e o nome podem
  // ser editados, porque é o contador quem define o plano de contas. Mas o tipo
  // não: ele é o que define o sentido do lançamento, e trocá-lo faria os
  // ajustes de entrada saírem como saída no Domínio.
  if (r.codigoSistema) {
    if (data.tipo !== undefined && data.tipo !== r.tipo) {
      throw { status:400, message:`O tipo da categoria "${r.nome}" não pode ser alterado: ele define o sentido do ajuste de saldo.` };
    }
    // O código é a identidade da categoria. Não sai daqui.
    data = { ...data, codigoSistema: r.codigoSistema };
  }

  // Receita/transferência sempre 'operacional'; só despesa pode ter distribuicao_lucros
  const tipoFinal = data.tipo !== undefined ? data.tipo : r.tipo;
  if (tipoFinal !== 'despesa') {
    data = { ...data, subtipo: 'operacional' };
  }
  return prisma.category.update({ where:{ id }, data });
}
async function remove(id, tenantId) {
  const r = await prisma.category.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Categoria não encontrada' };

  // Excluir a categoria do ajuste deixaria os ajustes futuros sem para onde ir,
  // e o sistema a recriaria em branco no ajuste seguinte.
  if (r.codigoSistema) {
    throw { status:400, message:`A categoria "${r.nome}" é usada pelo ajuste de saldo e não pode ser excluída.` };
  }

  await prisma.category.update({ where:{ id }, data:{ ativo:false } });
  return { ok:true };
}
module.exports = { list, create, update, remove };
