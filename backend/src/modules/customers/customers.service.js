// ─────────────────────────────────────────────────────────────────────────
// customers.service.js
//
// CRUD de Clientes. Multi-tenant via tenantId em todas as queries.
//
//   - normalizarDocumento extrai dígitos e detecta CPF (11) ou CNPJ (14)
//   - documento é único por tenant quando informado (HTTP 409 se duplicado)
//   - DELETE é soft delete (ativo = false)
//   - lista padrão filtra ativo: true; passe ?ativo=false pra ver inativos
//
// Etapa 4A: aceita campos extras (pessoaContato, emailsAdicionais,
// endereço estruturado e inscrições). Exporta helpers de normalização
// para o customers-import.service.js reaproveitar.
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

function normalizarTelefone(tel) {
  if (!tel) return null;
  const d = String(tel).replace(/\D/g, '');
  if (!d) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function normalizarEmailsAdicionais(input) {
  if (!input) return [];
  const arr = Array.isArray(input)
    ? input
    : String(input).split(/[\s,;]+/);
  return [...new Set(arr.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
}

function trim(v) { return v?.trim?.() || null; }

function normalizarCep(v) {
  if (!v) return null;
  const d = String(v).replace(/\D/g, '').slice(0, 8);
  return d || null;
}

function normalizarUf(v) {
  if (!v) return null;
  const u = String(v).trim().toUpperCase().slice(0, 2);
  return u || null;
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
        { email: { contains: search, mode: 'insensitive' } },
        { pessoaContato: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  return prisma.customer.findMany({ where, orderBy: { nome: 'asc' } });
}

async function findOne(id, tenantId) {
  const r = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!r) throw { status: 404, message: 'Cliente não encontrado' };
  return r;
}

async function create(tenantId, data) {
  const {
    nome, documento, email, telefone, endereco, observacao,
    pessoaContato, emailsAdicionais,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    inscricaoEstadual, inscricaoMunicipal,
  } = data || {};

  if (!nome || !nome.trim()) throw { status: 400, message: 'Nome é obrigatório' };

  const { documento: docNorm, tipoDocumento } = normalizarDocumento(documento);

  if (docNorm) {
    const dup = await prisma.customer.findFirst({
      where: { tenantId, documento: docNorm },
    });
    if (dup) throw { status: 409, message: 'Já existe cliente com este documento' };
  }

  return prisma.customer.create({
    data: {
      tenantId,
      nome: nome.trim(),
      documento: docNorm,
      tipoDocumento,
      email:               trim(email),
      telefone:            normalizarTelefone(telefone),
      endereco:            trim(endereco),
      observacao:          trim(observacao),
      pessoaContato:       trim(pessoaContato),
      emailsAdicionais:    normalizarEmailsAdicionais(emailsAdicionais),
      cep:                 normalizarCep(cep),
      logradouro:          trim(logradouro),
      numero:              trim(numero),
      complemento:         trim(complemento),
      bairro:              trim(bairro),
      cidade:              trim(cidade),
      uf:                  normalizarUf(uf),
      inscricaoEstadual:   trim(inscricaoEstadual),
      inscricaoMunicipal:  trim(inscricaoMunicipal),
    },
  });
}

async function update(id, tenantId, data) {
  const existente = await findOne(id, tenantId);

  const {
    nome, documento, email, telefone, endereco, observacao, ativo,
    pessoaContato, emailsAdicionais,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    inscricaoEstadual, inscricaoMunicipal,
  } = data || {};
  const { documento: docNorm, tipoDocumento } = normalizarDocumento(documento);

  if (docNorm && docNorm !== existente.documento) {
    const dup = await prisma.customer.findFirst({
      where: { tenantId, documento: docNorm, NOT: { id } },
    });
    if (dup) throw { status: 409, message: 'Já existe cliente com este documento' };
  }

  return prisma.customer.update({
    where: { id },
    data: {
      ...(nome              !== undefined && { nome: nome.trim() }),
      ...(documento         !== undefined && { documento: docNorm, tipoDocumento }),
      ...(email             !== undefined && { email: trim(email) }),
      ...(telefone          !== undefined && { telefone: normalizarTelefone(telefone) }),
      ...(endereco          !== undefined && { endereco: trim(endereco) }),
      ...(observacao        !== undefined && { observacao: trim(observacao) }),
      ...(ativo             !== undefined && { ativo: Boolean(ativo) }),
      ...(pessoaContato     !== undefined && { pessoaContato: trim(pessoaContato) }),
      ...(emailsAdicionais  !== undefined && { emailsAdicionais: normalizarEmailsAdicionais(emailsAdicionais) }),
      ...(cep               !== undefined && { cep: normalizarCep(cep) }),
      ...(logradouro        !== undefined && { logradouro: trim(logradouro) }),
      ...(numero            !== undefined && { numero: trim(numero) }),
      ...(complemento       !== undefined && { complemento: trim(complemento) }),
      ...(bairro            !== undefined && { bairro: trim(bairro) }),
      ...(cidade            !== undefined && { cidade: trim(cidade) }),
      ...(uf                !== undefined && { uf: normalizarUf(uf) }),
      ...(inscricaoEstadual !== undefined && { inscricaoEstadual: trim(inscricaoEstadual) }),
      ...(inscricaoMunicipal !== undefined && { inscricaoMunicipal: trim(inscricaoMunicipal) }),
    },
  });
}

async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.customer.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

module.exports = {
  list,
  findOne,
  create,
  update,
  remove,
  // Helpers reaproveitados pelo customers-import.service.js
  normalizarDocumento,
  normalizarTelefone,
  normalizarEmailsAdicionais,
};
