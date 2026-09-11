'use strict';

// ─────────────────────────────────────────────────────────────────────────
// De-para do cartão: texto do estabelecimento -> categoria e fornecedor.
//
// Separado do de-para de OFX de propósito. Fatura é quase toda nome de loja;
// extrato bancário é histórico genérico. Um padrão criado para um classificaria
// errado o outro.
//
// DOIS DEFEITOS DO DE-PARA DE OFX QUE NÃO SE REPETEM AQUI
//
// 1. Lá o empate entre dois padrões é resolvido pela ordem que o banco devolve,
//    que é arbitrária: `padroes.find(p => texto.includes(p.textoHistorico))`
//    sem nenhum orderBy. Se existirem "APPLE" e "APPLE.COM/BILL", qual vence é
//    sorte. Aqui há prioridade e, no empate, vence o texto mais longo.
//
// 2. Lá o complementoAuto é cadastrável na tela e o backend nunca o usa — o
//    select da consulta traz só textoHistorico e categoryId. Aqui ele é
//    aplicado de verdade no complemento do lançamento.
// ─────────────────────────────────────────────────────────────────────────

const prisma = require('../../config/database');

const includePadrao = {
  category: { select: { id: true, nome: true, tipo: true } },
  supplier: { select: { id: true, nome: true } },
};

/**
 * Deixa o texto comparável: maiúsculas, sem acento, espaço colapsado.
 *
 * Sem isso, "Padaria São João" não casaria com "PADARIA SAO JOAO", e dois
 * espaços no meio quebrariam a comparação.
 */
function normalizar(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────

async function list(tenantId) {
  return prisma.cardPattern.findMany({
    where:   { tenantId, ativo: true },
    include: includePadrao,
    // Mesma ordem do desempate, para a tela mostrar quem ganha de quem.
    orderBy: [{ prioridade: 'desc' }, { texto: 'asc' }],
  });
}

async function findOne(id, tenantId) {
  const p = await prisma.cardPattern.findFirst({ where: { id, tenantId }, include: includePadrao });
  if (!p) throw { status: 404, message: 'Padrão não encontrado' };
  return p;
}

async function validarVinculos(tenantId, { categoryId, supplierId }) {
  if (categoryId) {
    const c = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!c) throw { status: 404, message: 'Categoria não encontrada' };
  }
  if (supplierId) {
    const s = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!s) throw { status: 404, message: 'Fornecedor não encontrado' };
  }
}

async function create(tenantId, data = {}) {
  const texto = String(data.texto || '').trim();
  if (!texto) throw { status: 400, message: 'Texto do padrão obrigatório' };
  if (texto.length < 3) {
    throw {
      status: 400,
      message: 'Use pelo menos 3 caracteres. Texto muito curto casa com compras que não deveria.',
    };
  }
  if (!data.categoryId && !data.supplierId) {
    throw { status: 400, message: 'Informe ao menos a categoria ou o fornecedor' };
  }
  await validarVinculos(tenantId, data);

  return prisma.cardPattern.create({
    data: {
      tenantId,
      texto,
      categoryId:      data.categoryId || null,
      supplierId:      data.supplierId || null,
      complementoAuto: data.complementoAuto || null,
      prioridade:      parseInt(data.prioridade, 10) || 0,
    },
    include: includePadrao,
  });
}

async function update(id, tenantId, data = {}) {
  await findOne(id, tenantId);
  await validarVinculos(tenantId, data);

  if (data.texto !== undefined && String(data.texto).trim().length < 3) {
    throw { status: 400, message: 'Use pelo menos 3 caracteres no texto do padrão' };
  }

  return prisma.cardPattern.update({
    where: { id },
    data: {
      ...(data.texto           !== undefined && { texto: String(data.texto).trim() }),
      ...(data.categoryId      !== undefined && { categoryId: data.categoryId || null }),
      ...(data.supplierId      !== undefined && { supplierId: data.supplierId || null }),
      ...(data.complementoAuto !== undefined && { complementoAuto: data.complementoAuto || null }),
      ...(data.prioridade      !== undefined && { prioridade: parseInt(data.prioridade, 10) || 0 }),
    },
    include: includePadrao,
  });
}

async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.cardPattern.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Casamento
// ─────────────────────────────────────────────────────────────────────────

/**
 * Escolhe o padrão que casa com uma descrição.
 *
 * Recebe a lista já carregada para não consultar o banco por linha: uma fatura
 * tem dezenas de linhas e os padrões são os mesmos para todas.
 */
function casar(descricao, padroes) {
  const alvo = normalizar(descricao);
  if (!alvo) return null;

  const candidatos = padroes.filter((p) => p.texto && alvo.includes(normalizar(p.texto)));
  if (candidatos.length === 0) return null;

  // Prioridade manda. No empate, o texto mais longo é o mais específico:
  // "APPLE.COM/BILL" ganha de "APPLE".
  candidatos.sort((a, b) =>
    (b.prioridade - a.prioridade) || (normalizar(b.texto).length - normalizar(a.texto).length)
  );
  return candidatos[0];
}

/** Carrega os padrões ativos do tenant, prontos para o casar(). */
async function carregarAtivos(tenantId, tx = prisma) {
  return tx.cardPattern.findMany({
    where:  { tenantId, ativo: true },
    select: {
      id: true, texto: true, categoryId: true, supplierId: true,
      complementoAuto: true, prioridade: true,
    },
  });
}

module.exports = {
  list, findOne, create, update, remove,
  casar, carregarAtivos, normalizar,
};
