'use strict';

const crypto = require('crypto');
const prisma = require('../../config/database');
const { parseOfx } = require('./ofx-parser');

// ─────────────────────────────────────────────────────────────────────────────
// Importação de arquivo OFX
// ─────────────────────────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Valida que a conta bancária pertence ao tenant.
//   2. Calcula SHA256 do arquivo. Se já existir um OfxImport com o mesmo hash
//      no tenant, retorna 409 (DUPLICATE_FILE) com referência ao import original.
//   3. Faz parse do conteúdo OFX (parser tolera SGML 1.x e XML 2.x).
//   4. Filtra transações cujo FITID já existe na mesma conta — assim, mesmo
//      arquivos diferentes mas com sobreposição de período não duplicam linhas.
//   5. Cria OfxImport (cabeçalho) + OfxEntries (linhas individuais).
//   6. Tenta auto-match RÍGIDO contra Transactions existentes:
//        • mesmo bankAccountId
//        • mesma data exata (DATE)
//        • mesmo valor exato
//        • mesma direção (credito↔receita, debito↔despesa)
//        • Transaction ainda não conciliada e sem entry vinculado
//      Quando casa, seta OfxEntry.transactionId, OfxEntry.status='conciliado',
//      e Transaction.conciliadoEm = agora.
//   7. Para entries que ficam pendentes, aplica padrões OFX (textoHistorico
//      LIKE) para preencher suggestedCategoryId — vai ajudar no quick-create
//      da Etapa 5C.
//   8. Atualiza contadores no OfxImport (totalRegistros, conciliados, pendentes).
//
async function importFile({ tenantId, userId, bankAccountId, fileBuffer, fileName }) {
  if (!bankAccountId) {
    throw { status: 400, message: 'Conta bancária obrigatória.' };
  }
  if (!fileBuffer || !fileBuffer.length) {
    throw { status: 400, message: 'Arquivo OFX não recebido.' };
  }

  // 1. Conta deve pertencer ao tenant
  const conta = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId, ativo: true },
  });
  if (!conta) {
    throw { status: 404, message: 'Conta bancária não encontrada.' };
  }

  // 2. Hash de dedup
  const hashArquivo = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const existing = await prisma.ofxImport.findFirst({
    where: { tenantId, hashArquivo },
    select: { id: true, importadoEm: true, nomeArquivo: true },
  });
  if (existing) {
    throw {
      status: 409,
      message: `Arquivo já importado em ${formatDateBR(existing.importadoEm)}` +
               (existing.nomeArquivo ? ` como "${existing.nomeArquivo}".` : '.'),
      code: 'DUPLICATE_FILE',
      data: { existingImportId: existing.id },
    };
  }

  // 3. Parse
  let parsed;
  try {
    parsed = parseOfx(fileBuffer);
  } catch (e) {
    throw { status: 400, message: `Falha ao processar arquivo OFX: ${e.message}` };
  }
  if (!parsed.transactions.length) {
    throw { status: 400, message: 'Nenhuma transação encontrada no arquivo OFX.' };
  }

  // 4–8 dentro de transação
  return prisma.$transaction(async (tx) => {
    // 5a. Cria cabeçalho do import
    const dataInicio = parsed.period.start || parsed.transactions[0].dataMovimento;
    const dataFim    = parsed.period.end   || parsed.transactions[parsed.transactions.length - 1].dataMovimento;

    const imp = await tx.ofxImport.create({
      data: {
        tenantId,
        bankAccountId,
        nomeArquivo:    fileName || null,
        hashArquivo,
        dataInicio,
        dataFim,
        totalRegistros: parsed.transactions.length,
        importadoPor:   userId,
      },
    });

    // 5b. FITIDs já presentes nesta conta (em qualquer import anterior)
    const fitids = parsed.transactions.map((t) => t.fitid);
    const existingFitids = new Set(
      (await tx.ofxEntry.findMany({
        where: { bankAccountId, fitid: { in: fitids } },
        select: { fitid: true },
      })).map((e) => e.fitid)
    );

    // 5c. Cria apenas as entries com FITID novo
    const novasEntriesData = parsed.transactions
      .filter((t) => !existingFitids.has(t.fitid))
      .map((t) => ({
        tenantId,
        ofxImportId:   imp.id,
        bankAccountId,
        fitid:         t.fitid,
        dataMovimento: t.dataMovimento,
        valor:         t.valor,
        tipo:          t.tipo,           // 'credito' | 'debito'
        descricao:     truncar(t.descricao, 500),
        memo:          truncar(t.memo, 500),
        status:        'pendente',
      }));

    if (novasEntriesData.length === 0) {
      // Arquivo legítimo (hash diferente) mas todas as transações já
      // foram importadas em outro arquivo via FITID. Mantém o cabeçalho
      // como rastro mas zera os contadores.
      await tx.ofxImport.update({
        where: { id: imp.id },
        data: { totalRegistros: 0, conciliados: 0, pendentes: 0 },
      });
      return {
        importId:        imp.id,
        totalRegistros:  parsed.transactions.length,
        novasEntries:    0,
        duplicatasFitid: parsed.transactions.length,
        autoConciliados: 0,
        pendentes:       0,
      };
    }

    await tx.ofxEntry.createMany({ data: novasEntriesData });

    // Recarrega com IDs (createMany do Prisma não retorna registros)
    const entries = await tx.ofxEntry.findMany({
      where:   { ofxImportId: imp.id },
      orderBy: { dataMovimento: 'asc' },
    });

    // 6. Auto-match rígido
    let autoConciliados = 0;
    for (const e of entries) {
      const tipoTransaction = e.tipo === 'credito' ? 'receita' : 'despesa';
      const candidato = await tx.transaction.findFirst({
        where: {
          tenantId,
          bankAccountId,
          tipo:           tipoTransaction,
          dataLancamento: e.dataMovimento,
          valor:          e.valor,
          conciliadoEm:   null,
          ofxEntry:       { is: null },
          status:         { not: 'cancelado' },
        },
        orderBy: { criadoEm: 'asc' },
      });
      if (candidato) {
        const agora = new Date();
        await tx.ofxEntry.update({
          where: { id: e.id },
          data:  {
            transactionId: candidato.id,
            status:        'conciliado',
            conciliadoEm:  agora,
          },
        });
        await tx.transaction.update({
          where: { id: candidato.id },
          data:  { conciliadoEm: agora },
        });
        autoConciliados += 1;
      }
    }

    // 7. Sugere categoria nas pendentes
    await aplicarSugestoesCategoria(tx, tenantId, imp.id);

    // 8. Contadores
    const pendentes = entries.length - autoConciliados;
    await tx.ofxImport.update({
      where: { id: imp.id },
      data:  {
        totalRegistros: entries.length,
        conciliados:    autoConciliados,
        pendentes,
      },
    });

    return {
      importId:        imp.id,
      totalRegistros:  parsed.transactions.length,
      novasEntries:    entries.length,
      duplicatasFitid: parsed.transactions.length - entries.length,
      autoConciliados,
      pendentes,
    };
  });
}

/** Pré-popula suggestedCategoryId de entries pendentes via OfxPattern. */
async function aplicarSugestoesCategoria(tx, tenantId, ofxImportId) {
  const padroes = await tx.ofxPattern.findMany({
    where:  { tenantId, ativo: true },
    select: { textoHistorico: true, categoryId: true },
  });
  if (!padroes.length) return;

  const entries = await tx.ofxEntry.findMany({
    where:  { ofxImportId, status: 'pendente', suggestedCategoryId: null },
    select: { id: true, descricao: true, memo: true },
  });

  for (const e of entries) {
    const texto = `${e.descricao || ''} ${e.memo || ''}`.toUpperCase();
    if (!texto.trim()) continue;
    const match = padroes.find(
      (p) => p.textoHistorico && texto.includes(p.textoHistorico.toUpperCase())
    );
    if (match && match.categoryId) {
      await tx.ofxEntry.update({
        where: { id: e.id },
        data:  { suggestedCategoryId: match.categoryId },
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Listagens
// ─────────────────────────────────────────────────────────────────────────────

async function listImports(tenantId, filters = {}) {
  const { bankAccountId, page = 1, limit = 50 } = filters;
  const p = parseInt(page, 10);
  const l = parseInt(limit, 10);
  const skip = (p - 1) * l;

  const where = {
    tenantId,
    ...(bankAccountId && { bankAccountId }),
  };

  const [data, total] = await Promise.all([
    prisma.ofxImport.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, nome: true, banco: true } },
        importador:  { select: { id: true, nome: true } },
      },
      orderBy: { importadoEm: 'desc' },
      skip,
      take: l,
    }),
    prisma.ofxImport.count({ where }),
  ]);

  return { data, total, page: p, totalPages: Math.ceil(total / l) };
}

async function findImport(id, tenantId) {
  const imp = await prisma.ofxImport.findFirst({
    where: { id, tenantId },
    include: {
      bankAccount: {
        select: { id: true, nome: true, banco: true, agencia: true, conta: true },
      },
      importador: { select: { id: true, nome: true } },
    },
  });
  if (!imp) throw { status: 404, message: 'Importação OFX não encontrada.' };
  return imp;
}

async function listEntries(importId, tenantId, filters = {}) {
  const imp = await findImport(importId, tenantId); // garante isolamento
  const { status } = filters;

  const entries = await prisma.ofxEntry.findMany({
    where: {
      ofxImportId: importId,
      tenantId,
      ...(status && { status }),
    },
    include: {
      transaction: {
        include: {
          category:    { select: { id: true, nome: true } },
          bankAccount: { select: { id: true, nome: true } },
        },
      },
      suggestedCategory: { select: { id: true, nome: true } },
    },
    orderBy: [{ dataMovimento: 'asc' }, { criadoEm: 'asc' }],
  });

  // Conta por status (todas, ignorando filtro) — útil pros badges da UI
  const counts = await prisma.ofxEntry.groupBy({
    by:   ['status'],
    where: { ofxImportId: importId, tenantId },
    _count: { _all: true },
  });
  const summary = { pendente: 0, conciliado: 0, ignorado: 0 };
  for (const c of counts) summary[c.status] = c._count._all;

  return { import: imp, entries, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Remoção de import
// ─────────────────────────────────────────────────────────────────────────────
//
// Deletar um import desfaz a conciliação de todas as Transactions vinculadas,
// remove as OfxEntries e remove o cabeçalho. Não toca em Transactions criadas
// via quick-create (Etapa 5C) — essas terão `origem='ofx'` e `ofxImportId` setado;
// o usuário precisará removê-las manualmente se quiser.
//
async function removeImport(id, tenantId) {
  const imp = await prisma.ofxImport.findFirst({ where: { id, tenantId } });
  if (!imp) throw { status: 404, message: 'Importação OFX não encontrada.' };

  return prisma.$transaction(async (tx) => {
    const linkedEntries = await tx.ofxEntry.findMany({
      where:  { ofxImportId: id, transactionId: { not: null } },
      select: { transactionId: true },
    });
    const txIds = linkedEntries.map((e) => e.transactionId).filter(Boolean);

    if (txIds.length) {
      await tx.transaction.updateMany({
        where: { id: { in: txIds } },
        data:  { conciliadoEm: null },
      });
    }

    await tx.ofxEntry.deleteMany({ where: { ofxImportId: id } });
    await tx.ofxImport.delete({ where: { id } });
    return { ok: true, transactionsDesconciliadas: txIds.length };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncar(s, max) {
  if (!s) return null;
  return s.length > max ? s.substring(0, max) : s;
}

function formatDateBR(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

module.exports = {
  importFile,
  listImports,
  findImport,
  listEntries,
  removeImport,
};
