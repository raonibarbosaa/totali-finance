// ─────────────────────────────────────────────────────────────────────────
// customers-import.service.js — Etapa 4A
//
// Importação em massa de clientes a partir de planilhas .xlsx/.xls/.csv
// no formato exportado pelo Domínio Contábil.
//
// Colunas reconhecidas (case/acento-insensitive):
//   Nome da Empresa            → nome           (obrigatória)
//   Business No                → documento      (obrigatória)
//   E-mail                     → email
//   Contatos adicionais        → emailsAdicionais
//   Pessoa de Contato          → pessoaContato
//   Telefone                   → telefone
//   Notas                      → observacao
//
// Comportamento de duplicatas: ATUALIZA registros existentes
// (upsert por tenantId + documento).
//
// API:
//   preview(tenantId, buffer)  → análise sem persistir (validação + diff)
//   execute(tenantId, buffer)  → executa o upsert e retorna relatório
// ─────────────────────────────────────────────────────────────────────────

const XLSX = require('xlsx');
const prisma = require('../../config/database');
const cs = require('./customers.service');

// ── Validação de CPF/CNPJ ───────────────────────────────────────────────

function validarCPF(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i], 10) * (10 - i);
  let v = 11 - (s % 11); if (v >= 10) v = 0;
  if (v !== parseInt(d[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i], 10) * (11 - i);
  v = 11 - (s % 11); if (v >= 10) v = 0;
  return v === parseInt(d[10], 10);
}

function validarCNPJ(cnpj) {
  const d = String(cnpj).replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base, weights) => {
    const sum = base.split('').reduce((a, c, i) => a + parseInt(c, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  if (calc(d.slice(0, 12), w1) !== parseInt(d[12], 10)) return false;
  return calc(d.slice(0, 13), w2) === parseInt(d[13], 10);
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (e) => typeof e === 'string' && EMAIL_RX.test(e.trim());

// ── Mapeamento de colunas ───────────────────────────────────────────────

const normHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADER_MAP = {
  nome:             ['nome da empresa', 'nome', 'razao social'],
  documento:        ['business no', 'cpf cnpj', 'cnpj cpf', 'documento', 'cpf', 'cnpj'],
  email:            ['e mail', 'email'],
  emailsAdicionais: ['contatos adicionais e mails', 'contatos adicionais', 'e mails adicionais', 'emails adicionais'],
  pessoaContato:    ['pessoa de contato', 'contato', 'responsavel'],
  telefone:         ['telefone', 'fone', 'celular'],
  observacao:       ['notas', 'observacoes', 'obs', 'observacao'],
};

function buildMapping(headerRow) {
  const mapping = {};
  const norm = headerRow.map(normHeader);
  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    const idx = norm.findIndex((h) => aliases.includes(h));
    if (idx !== -1) mapping[field] = idx;
  }
  const missing = [];
  if (mapping.nome === undefined)      missing.push('Nome da Empresa');
  if (mapping.documento === undefined) missing.push('Business No');
  return { mapping, missing };
}

// ── Parsing ─────────────────────────────────────────────────────────────

function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw { status: 400, message: 'Planilha vazia' };
  const sheet = wb.Sheets[sheetName];

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,        // converte tudo pra string (preserva telefones)
    blankrows: false,
  });

  if (matrix.length < 2) return { mapping: {}, rows: [], missing: [], totalRows: 0 };

  const { mapping, missing } = buildMapping(matrix[0]);

  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (r.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    rows.push({
      _rowNumber: i + 1,
      nome:             mapping.nome             !== undefined ? r[mapping.nome] : null,
      documento:        mapping.documento        !== undefined ? r[mapping.documento] : null,
      email:            mapping.email            !== undefined ? r[mapping.email] : null,
      emailsAdicionais: mapping.emailsAdicionais !== undefined ? r[mapping.emailsAdicionais] : null,
      pessoaContato:    mapping.pessoaContato    !== undefined ? r[mapping.pessoaContato] : null,
      telefone:         mapping.telefone         !== undefined ? r[mapping.telefone] : null,
      observacao:       mapping.observacao       !== undefined ? r[mapping.observacao] : null,
    });
  }

  return { mapping, rows, missing, totalRows: rows.length };
}

// ── Validação ───────────────────────────────────────────────────────────

function validateRows(rows) {
  const valid = [];
  const invalid = [];
  const seenDocs = new Map();

  for (const row of rows) {
    const errors = [];

    const nome = String(row.nome ?? '').trim();
    if (!nome) errors.push({ field: 'nome', message: 'Nome ausente' });

    const { documento: docNorm, tipoDocumento } = cs.normalizarDocumento(row.documento);
    if (!tipoDocumento) {
      errors.push({ field: 'documento', message: 'CPF/CNPJ com tamanho inválido' });
    } else {
      const valido = tipoDocumento === 'CPF' ? validarCPF(docNorm) : validarCNPJ(docNorm);
      if (!valido) errors.push({ field: 'documento', message: 'CPF/CNPJ com dígitos verificadores inválidos' });
    }

    let emailNorm = null;
    if (row.email && String(row.email).trim()) {
      const e = String(row.email).trim().toLowerCase();
      if (!isValidEmail(e)) errors.push({ field: 'email', message: 'E-mail inválido' });
      else emailNorm = e;
    }

    if (errors.length > 0) {
      invalid.push({ _rowNumber: row._rowNumber, errors, raw: row });
      continue;
    }

    if (seenDocs.has(docNorm)) seenDocs.get(docNorm).push(row._rowNumber);
    else seenDocs.set(docNorm, [row._rowNumber]);

    valid.push({
      _rowNumber: row._rowNumber,
      nome,
      documento: docNorm,
      tipoDocumento,
      email: emailNorm,
      emailsAdicionais: cs.normalizarEmailsAdicionais(row.emailsAdicionais),
      telefone:         cs.normalizarTelefone(row.telefone),
      pessoaContato:    row.pessoaContato ? String(row.pessoaContato).trim() || null : null,
      observacao:       row.observacao    ? String(row.observacao).trim()    || null : null,
    });
  }

  // Duplicatas dentro do próprio arquivo: mantém a primeira, descarta as outras
  const duplicatesInFile = [];
  for (const [doc, rns] of seenDocs.entries()) {
    if (rns.length > 1) {
      const [keep, ...rest] = rns;
      for (const rn of rest) {
        duplicatesInFile.push({ _rowNumber: rn, documento: doc, conflictsWith: keep });
      }
      for (let i = valid.length - 1; i >= 0; i--) {
        if (valid[i].documento === doc && valid[i]._rowNumber !== keep) valid.splice(i, 1);
      }
    }
  }

  return { valid, invalid, duplicatesInFile };
}

// ── Preview (sem persistir) ─────────────────────────────────────────────

async function preview(tenantId, buffer) {
  const { mapping, rows, missing, totalRows } = parseSheet(buffer);

  if (missing.length > 0) {
    return { ok: false, reason: 'missing_required_columns', missing, mapping, totalRows: 0, sample: [] };
  }

  const { valid, invalid, duplicatesInFile } = validateRows(rows);

  const docs = valid.map((v) => v.documento);
  const existentes = await prisma.customer.findMany({
    where: { tenantId, documento: { in: docs } },
    select: { id: true, documento: true, nome: true },
  });
  const mapaExistentes = new Map(existentes.map((e) => [e.documento, e]));

  return {
    ok: true,
    mapping,
    totalRows,
    summary: {
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicatesInFileCount: duplicatesInFile.length,
      willCreate: valid.filter((v) => !mapaExistentes.has(v.documento)).length,
      willUpdate: valid.filter((v) =>  mapaExistentes.has(v.documento)).length,
    },
    sample: valid.slice(0, 10).map((v) => ({
      ...v,
      action: mapaExistentes.has(v.documento) ? 'update' : 'create',
      existingName: mapaExistentes.get(v.documento)?.nome ?? null,
    })),
    errors: [
      ...invalid.map((i) => ({
        rowNumber: i._rowNumber,
        kind: 'invalid',
        errors: i.errors,
        raw: { nome: i.raw.nome, documento: i.raw.documento },
      })),
      ...duplicatesInFile.map((d) => ({
        rowNumber: d._rowNumber,
        kind: 'duplicate_in_file',
        message: `Documento ${d.documento} também aparece na linha ${d.conflictsWith}`,
      })),
    ],
  };
}

// ── Execução ────────────────────────────────────────────────────────────

async function execute(tenantId, buffer) {
  const { rows, missing, totalRows } = parseSheet(buffer);
  if (missing.length > 0) {
    throw { status: 400, message: `Colunas obrigatórias ausentes: ${missing.join(', ')}` };
  }

  const { valid, invalid, duplicatesInFile } = validateRows(rows);

  let createdCount = 0;
  let updatedCount = 0;
  const errorList = [
    ...invalid.map((i) => ({ row: i._rowNumber, kind: 'invalid', errors: i.errors })),
    ...duplicatesInFile.map((d) => ({
      row: d._rowNumber,
      kind: 'duplicate_in_file',
      message: `Documento duplicado na linha ${d.conflictsWith}`,
    })),
  ];

  for (const v of valid) {
    try {
      const existente = await prisma.customer.findFirst({
        where: { tenantId, documento: v.documento },
      });

      const payload = {
        nome: v.nome,
        documento: v.documento,
        tipoDocumento: v.tipoDocumento,
        email: v.email,
        emailsAdicionais: v.emailsAdicionais,
        telefone: v.telefone,
        pessoaContato: v.pessoaContato,
        observacao: v.observacao,
      };

      if (existente) {
        await prisma.customer.update({ where: { id: existente.id }, data: payload });
        updatedCount++;
      } else {
        await prisma.customer.create({ data: { tenantId, ...payload } });
        createdCount++;
      }
    } catch (e) {
      errorList.push({ row: v._rowNumber, kind: 'persist_error', message: e.message });
    }
  }

  return {
    totalRows,
    createdCount,
    updatedCount,
    errorCount: errorList.length,
    errors: errorList,
  };
}

module.exports = { preview, execute, parseSheet, validateRows };
