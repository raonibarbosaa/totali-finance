// ─────────────────────────────────────────────────────────────────────────
// suppliers.service.js
//
// CRUD de Fornecedores. Multi-tenant via tenantId em todas as queries.
//
//   - normalizarDocumento extrai dígitos e detecta CPF (11) ou CNPJ (14)
//   - documento é único por tenant quando informado (HTTP 409 se duplicado)
//   - DELETE é soft delete (ativo = false)
//   - lista padrão filtra ativo: true; passe ?ativo=false pra ver inativos
// ─────────────────────────────────────────────────────────────────────────

const prisma = require('../../config/database');

function normalizarDocumento(doc) {
  if (!doc) return { documento: null, tipoDocumento: null };
  const limpo = String(doc).replace(/\D/g, '');
  if (!limpo) return { documento: null, tipoDocumento: null };
  if (limpo.length === 11) return { documento: limpo, tipoDocumento: 'CPF' };
  if (limpo.length === 14) return { documento: limpo, tipoDocumento: 'CNPJ' };
  return { documento: limpo, tipoDocumento: null };
}

async function list(tenantId, filters = {}) {
  const { search, ativo } = filters;
  const where = {
    tenantId,
    ...(ativo === undefined
      ? { ativo: true }
      : { ativo: ativo === 'true' || ativo === true }),
    ...(search && {
      OR: [
        { nome: { contains: search, mode: 'insensitive' } },
        { documento: { contains: String(search).replace(/\D/g, '') || '__nope__' } },
      ],
    }),
  };
  return prisma.supplier.findMany({ where, orderBy: { nome: 'asc' } });
}

async function findOne(id, tenantId) {
  const r = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!r) throw { status: 404, message: 'Fornecedor não encontrado' };
  return r;
}

async function create(tenantId, data) {
  const { nome, documento, email, telefone, endereco, observacao } = data || {};

  if (!nome || !nome.trim()) throw { status: 400, message: 'Nome é obrigatório' };

  const { documento: docNorm, tipoDocumento } = normalizarDocumento(documento);

  if (docNorm) {
    const dup = await prisma.supplier.findFirst({
      where: { tenantId, documento: docNorm },
    });
    if (dup) throw { status: 409, message: 'Já existe fornecedor com este documento' };
  }

  return prisma.supplier.create({
    data: {
      tenantId,
      nome: nome.trim(),
      documento: docNorm,
      tipoDocumento,
      email:      email?.trim()      || null,
      telefone:   telefone?.trim()   || null,
      endereco:   endereco?.trim()   || null,
      observacao: observacao?.trim() || null,
    },
  });
}

async function update(id, tenantId, data) {
  const existente = await findOne(id, tenantId);

  const { nome, documento, email, telefone, endereco, observacao, ativo } = data || {};
  const { documento: docNorm, tipoDocumento } = normalizarDocumento(documento);

  if (docNorm && docNorm !== existente.documento) {
    const dup = await prisma.supplier.findFirst({
      where: { tenantId, documento: docNorm, NOT: { id } },
    });
    if (dup) throw { status: 409, message: 'Já existe fornecedor com este documento' };
  }

  return prisma.supplier.update({
    where: { id },
    data: {
      ...(nome       !== undefined && { nome: nome.trim() }),
      ...(documento  !== undefined && { documento: docNorm, tipoDocumento }),
      ...(email      !== undefined && { email: email?.trim() || null }),
      ...(telefone   !== undefined && { telefone: telefone?.trim() || null }),
      ...(endereco   !== undefined && { endereco: endereco?.trim() || null }),
      ...(observacao !== undefined && { observacao: observacao?.trim() || null }),
      ...(ativo      !== undefined && { ativo: Boolean(ativo) }),
    },
  });
}

async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.supplier.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

module.exports = { list, findOne, create, update, remove };
