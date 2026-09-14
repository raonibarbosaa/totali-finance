// Padroes OFX: texto do historico do extrato -> categoria.
//
// Sempre que um padrao muda, as SUGESTOES das linhas de extrato ainda pendentes
// sao recalculadas (reaplicarSugestoes). Sem isso, o padrao criado ali na tela
// de conciliacao so valeria para a proxima importacao: a linha continuava sem
// sugestao no banco, e a conciliacao em massa criava o lancamento sem
// categoria, mesmo com a tela mostrando "Padrao ativo".
//
// O recalculo alcanca todas as pendencias do tenant, nao so o arquivo aberto —
// o padrao e da empresa, nao do arquivo.

const prisma = require('../../config/database');
const ofxSvc = require('../ofx/ofx.service');

async function list(tenantId) {
  return prisma.ofxPattern.findMany({ where:{ tenantId, ativo:true }, include:{ category:{select:{id:true,nome:true}} }, orderBy:{ textoHistorico:'asc' } });
}

async function create(tenantId, data) {
  const { textoHistorico, categoryId, complementoAuto } = data;
  if (!textoHistorico) throw { status:400, message:'Texto do histórico obrigatório' };
  const padrao = await prisma.ofxPattern.create({ data:{ tenantId, textoHistorico, categoryId:categoryId||null, complementoAuto:complementoAuto||null }, include:{category:true} });
  const sugestoesAtualizadas = await ofxSvc.reaplicarSugestoes(tenantId);
  return { ...padrao, sugestoesAtualizadas };
}

async function update(id, tenantId, data) {
  const r = await prisma.ofxPattern.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Padrão não encontrado' };
  const padrao = await prisma.ofxPattern.update({ where:{id}, data, include:{category:true} });
  const sugestoesAtualizadas = await ofxSvc.reaplicarSugestoes(tenantId);
  return { ...padrao, sugestoesAtualizadas };
}

async function remove(id, tenantId) {
  const r = await prisma.ofxPattern.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:'Padrão não encontrado' };
  await prisma.ofxPattern.update({ where:{id}, data:{ativo:false} });
  // Sem o padrao, as linhas que dependiam dele voltam a ficar sem sugestao.
  const sugestoesAtualizadas = await ofxSvc.reaplicarSugestoes(tenantId);
  return { ok:true, sugestoesAtualizadas };
}

module.exports = { list, create, update, remove };
