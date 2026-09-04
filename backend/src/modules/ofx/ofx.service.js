'use strict';

const crypto = require('crypto');
const prisma = require('../../config/database');
const { parseOfx } = require('./ofx-parser');

// ─────────────────────────────────────────────────────────────────────────────
// Importação de arquivo OFX (Etapa 5A)
// ─────────────────────────────────────────────────────────────────────────────
async function importFile({ tenantId, userId, bankAccountId, fileBuffer, fileName }) {
  if (!bankAccountId) throw { status: 400, message: 'Conta bancária obrigatória.' };
  if (!fileBuffer || !fileBuffer.length) throw { status: 400, message: 'Arquivo OFX não recebido.' };

  const conta = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId, ativo: true },
  });
  if (!conta) throw { status: 404, message: 'Conta bancária não encontrada.' };

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

  let parsed;
  try {
    parsed = parseOfx(fileBuffer);
  } catch (e) {
    throw { status: 400, message: `Falha ao processar arquivo OFX: ${e.message}` };
  }
  if (!parsed.transactions.length) {
    throw { status: 400, message: 'Nenhuma transação encontrada no arquivo OFX.' };
  }

  // Alguns bancos emitem OFX malformado com todos os FITIDs iguais
  // (ex: Kolek emite '1' para todas as transações). Detecta duplicatas
  // intra-arquivo e substitui por FITIDs sintéticos baseados no conteúdo.
  // Re-imports do mesmo conteúdo gerarão o mesmo hash sintético, mantendo
  // dedup transacional funcional. (Dedup por hash do arquivo inteiro
  // continua sendo a primeira linha de defesa contra reimport duplo.)
  const fitidsSinteticos = garantirFitidsUnicos(parsed.transactions);

  return prisma.$transaction(async (tx) => {
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

    const fitids = parsed.transactions.map((t) => t.fitid);

    // FITIDs que já existem em ofx_entries desta conta (de importações anteriores).
    // Opção A: em vez de descartá-los, REAPROVEITAMOS — movemos esses entries
    // para a importação atual, preservando status (conciliado/pendente/ignorado)
    // e o vínculo com a Transaction (transactionId). Assim eles aparecem nas
    // abas corretas DESTA importação (ex.: já conciliados vão pra aba Conciliadas).
    const entriesExistentes = await tx.ofxEntry.findMany({
      where:  { bankAccountId, fitid: { in: fitids } },
      select: { id: true, fitid: true },
    });
    const idsExistentes      = entriesExistentes.map((e) => e.id);
    const existingFitidsSet  = new Set(entriesExistentes.map((e) => e.fitid));

    // Reaproveita: traz os entries existentes para esta importação.
    if (idsExistentes.length) {
      await tx.ofxEntry.updateMany({
        where: { id: { in: idsExistentes } },
        data:  { ofxImportId: imp.id },
      });
    }

    // Apenas os FITIDs realmente novos viram entries 'pendente'.
    const novasEntriesData = parsed.transactions
      .filter((t) => !existingFitidsSet.has(t.fitid))
      .map((t) => ({
        tenantId,
        ofxImportId:   imp.id,
        bankAccountId,
        fitid:         t.fitid,
        dataMovimento: t.dataMovimento,
        valor:         t.valor,
        tipo:          t.tipo,
        descricao:     truncar(t.descricao, 500),
        memo:          truncar(t.memo, 500),
        status:        'pendente',
      }));

    if (novasEntriesData.length) {
      await tx.ofxEntry.createMany({ data: novasEntriesData });
    }

    const entries = await tx.ofxEntry.findMany({
      where:   { ofxImportId: imp.id },
      orderBy: { dataMovimento: 'asc' },
    });

    // Só passam pelo auto-match as entries pendentes ainda sem vínculo.
    // Entries reaproveitadas de importações anteriores (já conciliadas ou
    // ignoradas) mantêm seu estado e não são reprocessadas.
    const entriesParaAutoMatch = entries.filter(
      (e) => e.status === 'pendente' && !e.transactionId
    );

    let autoConciliados = 0;
    for (const e of entriesParaAutoMatch) {
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

    await aplicarSugestoesCategoria(tx, tenantId, imp.id);

    // Recalcula contadores a partir do estado real de TODAS as entries do
    // import (novas + reaproveitadas), agrupando por status.
    await recalcularContadoresImport(tx, imp.id);

    const reaproveitadas = idsExistentes.length;
    const novas          = novasEntriesData.length;

    // Conciliados refletidos nesta importação: os auto-conciliados agora +
    // os reaproveitados que já vieram conciliados de antes.
    const jaConciliadasReaproveitadas = await tx.ofxEntry.count({
      where: { ofxImportId: imp.id, status: 'conciliado' },
    });
    const pendentesFinal = await tx.ofxEntry.count({
      where: { ofxImportId: imp.id, status: 'pendente' },
    });

    return {
      importId:        imp.id,
      totalRegistros:  parsed.transactions.length,
      novasEntries:    novas,
      reaproveitadas,
      duplicatasFitid: reaproveitadas,
      autoConciliados,
      conciliados:     jaConciliadasReaproveitadas,
      pendentes:       pendentesFinal,
    };
  });
}

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
// Listagens (Etapa 5A)
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
  const imp = await findImport(importId, tenantId);
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
// Remoção de import (Etapa 5A — atualizado na 5B)
// ─────────────────────────────────────────────────────────────────────────────
//
// Comportamento ajustado na 5B: Transactions criadas via quick-create
// (origem='ofx' e ofxImportId apontando pra ESTE import) são apagadas junto.
// Transactions que existiam antes do import (manual) e foram só conciliadas
// pelo auto-match são apenas desconciliadas — nunca são deletadas.
//
async function removeImport(id, tenantId) {
  const imp = await prisma.ofxImport.findFirst({ where: { id, tenantId } });
  if (!imp) throw { status: 404, message: 'Importação OFX não encontrada.' };

  return prisma.$transaction(async (tx) => {
    // Transactions vinculadas a entries deste import
    const linkedEntries = await tx.ofxEntry.findMany({
      where:  { ofxImportId: id, transactionId: { not: null } },
      select: { transactionId: true, transaction: { select: { origem: true, ofxImportId: true, exportado: true } } },
    });

    const txsParaDeletar = [];
    const txsParaDesconciliar = [];

    for (const e of linkedEntries) {
      const t = e.transaction;
      if (!t) continue;

      const veioDoQuickCreate = t.origem === 'ofx' && t.ofxImportId === id;

      if (veioDoQuickCreate) {
        if (t.exportado) {
          // Lançamento já exportado pra Domínio — não pode deletar.
          // Mantém a Transaction, só desconcilia.
          txsParaDesconciliar.push(e.transactionId);
        } else {
          txsParaDeletar.push(e.transactionId);
        }
      } else {
        txsParaDesconciliar.push(e.transactionId);
      }
    }

    if (txsParaDesconciliar.length) {
      await tx.transaction.updateMany({
        where: { id: { in: txsParaDesconciliar } },
        data:  { conciliadoEm: null },
      });
    }

    // Apaga as entries antes de apagar Transactions, pra liberar a FK
    await tx.ofxEntry.deleteMany({ where: { ofxImportId: id } });

    if (txsParaDeletar.length) {
      await tx.transaction.deleteMany({ where: { id: { in: txsParaDeletar } } });
    }

    await tx.ofxImport.delete({ where: { id } });

    return {
      ok: true,
      transactionsDesconciliadas: txsParaDesconciliar.length,
      transactionsDeletadas:      txsParaDeletar.length,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ações sobre entries (Etapa 5B)
// ─────────────────────────────────────────────────────────────────────────────

/** Vincula uma entry pendente a uma Transaction existente. */
async function linkEntry(entryId, tenantId, body = {}) {
  const { transactionId } = body;
  if (!transactionId) throw { status: 400, message: 'transactionId obrigatório.' };

  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };
  if (entry.status === 'conciliado' && entry.transactionId) {
    throw { status: 400, message: 'Esta entry já está conciliada. Desvincule antes de vincular novamente.' };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, tenantId },
    include: { ofxEntry: { select: { id: true } } },
  });
  if (!transaction) throw { status: 404, message: 'Lançamento não encontrado.' };
  if (transaction.bankAccountId !== entry.bankAccountId) {
    throw { status: 400, message: 'Lançamento é de outra conta bancária.' };
  }
  if (transaction.status === 'cancelado') {
    throw { status: 400, message: 'Lançamento cancelado não pode ser conciliado.' };
  }
  if (transaction.ofxEntry) {
    throw { status: 400, message: 'Este lançamento já está vinculado a outra entry OFX.' };
  }

  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    const updatedEntry = await tx.ofxEntry.update({
      where: { id: entryId },
      data:  {
        transactionId,
        status:       'conciliado',
        conciliadoEm: agora,
      },
      include: {
        transaction: {
          include: {
            category:    { select: { id: true, nome: true } },
            bankAccount: { select: { id: true, nome: true } },
          },
        },
      },
    });

    await tx.transaction.update({
      where: { id: transactionId },
      data:  { conciliadoEm: agora },
    });

    await recalcularContadoresImport(tx, entry.ofxImportId);

    return updatedEntry;
  });
}

/** Desfaz a conciliação: entry volta a 'pendente', transaction perde conciliadoEm. */
async function unlinkEntry(entryId, tenantId) {
  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
    include: {
      transaction: { select: { id: true, origem: true, ofxImportId: true, exportado: true } },
    },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };
  if (entry.status !== 'conciliado' || !entry.transactionId) {
    throw { status: 400, message: 'Esta entry não está conciliada.' };
  }

  // Bloqueia desvincular se a Transaction veio de quick-create + foi exportada,
  // pra evitar entry órfã apontando pra Transaction "intocável" sem trilha.
  const t = entry.transaction;
  const veioDoQuickCreate = t && t.origem === 'ofx' && t.ofxImportId === entry.ofxImportId;
  if (veioDoQuickCreate && t.exportado) {
    throw {
      status: 400,
      message: 'Lançamento criado por esta entry já foi exportado pra Domínio e não pode ser desvinculado.',
    };
  }

  return prisma.$transaction(async (tx) => {
    const updatedEntry = await tx.ofxEntry.update({
      where: { id: entryId },
      data:  {
        transactionId: null,
        status:        'pendente',
        conciliadoEm:  null,
      },
    });

    if (entry.transactionId) {
      await tx.transaction.update({
        where: { id: entry.transactionId },
        data:  { conciliadoEm: null },
      });
    }

    await recalcularContadoresImport(tx, entry.ofxImportId);

    return updatedEntry;
  });
}

/** Marca entry pendente como 'ignorada'. */
async function ignoreEntry(entryId, tenantId) {
  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };
  if (entry.status !== 'pendente') {
    throw { status: 400, message: 'Apenas entries pendentes podem ser ignoradas.' };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ofxEntry.update({
      where: { id: entryId },
      data:  { status: 'ignorado', ignoradoEm: new Date() },
    });
    await recalcularContadoresImport(tx, entry.ofxImportId);
    return updated;
  });
}

/** Reverte 'ignorada' → 'pendente'. */
async function unignoreEntry(entryId, tenantId) {
  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };
  if (entry.status !== 'ignorado') {
    throw { status: 400, message: 'Esta entry não está ignorada.' };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ofxEntry.update({
      where: { id: entryId },
      data:  { status: 'pendente', ignoradoEm: null },
    });
    await recalcularContadoresImport(tx, entry.ofxImportId);
    return updated;
  });
}

/**
 * Sugere candidatos pra vínculo manual de uma entry pendente.
 *
 * Filtros: mesma conta bancária, status != cancelado, sem entry vinculada,
 * valor com tolerância de ±10% e data com tolerância de ±5 dias.
 *
 * Ordena por proximidade (data + valor) e retorna até 20.
 */
async function matchCandidates(entryId, tenantId, opts = {}) {
  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };

  const tipoTransaction = entry.tipo === 'credito' ? 'receita' : 'despesa';
  const valor = Number(entry.valor);
  const valorMin = valor * 0.90;
  const valorMax = valor * 1.10;
  const dataMin = new Date(entry.dataMovimento);
  dataMin.setDate(dataMin.getDate() - 5);
  const dataMax = new Date(entry.dataMovimento);
  dataMax.setDate(dataMax.getDate() + 5);

  const candidatos = await prisma.transaction.findMany({
    where: {
      tenantId,
      bankAccountId:  entry.bankAccountId,
      tipo:           tipoTransaction,
      conciliadoEm:   null,
      ofxEntry:       { is: null },
      status:         { not: 'cancelado' },
      dataLancamento: { gte: dataMin, lte: dataMax },
      valor:          { gte: valorMin, lte: valorMax },
    },
    include: {
      category:    { select: { id: true, nome: true } },
      bankAccount: { select: { id: true, nome: true } },
    },
    orderBy: { dataLancamento: 'asc' },
    take: 50, // pega mais e ordena por proximidade na app
  });

  const refTime = entry.dataMovimento.getTime();
  const sorted = candidatos
    .map((c) => ({
      ...c,
      _distancia: {
        dias:        Math.abs((c.dataLancamento.getTime() - refTime) / 86400000),
        valorPct:    Math.abs((Number(c.valor) - valor) / valor),
      },
    }))
    .sort((a, b) => {
      // Match perfeito de data primeiro, depois proximidade combinada
      const scoreA = a._distancia.dias + a._distancia.valorPct * 10;
      const scoreB = b._distancia.dias + b._distancia.valorPct * 10;
      return scoreA - scoreB;
    })
    .slice(0, 20);

  return { entry, candidatos: sorted };
}

/**
 * Quick-create: cria uma Transaction nova já conciliada com a entry.
 *
 * Pré-preenche tudo a partir da entry. Body pode sobrescrever:
 *   { categoryId?, descricao?, complemento?, dataCompetencia? }
 *
 * Importante: Transaction.origem = 'ofx', Transaction.ofxImportId = entry.ofxImportId.
 * Se o usuário deletar o import depois, essa Transaction é apagada junto
 * (tratado em removeImport).
 */
async function quickCreateFromEntry(entryId, tenantId, userId, body = {}) {
  const entry = await prisma.ofxEntry.findFirst({
    where: { id: entryId, tenantId },
  });
  if (!entry) throw { status: 404, message: 'Entry OFX não encontrada.' };
  if (entry.status === 'conciliado' && entry.transactionId) {
    throw { status: 400, message: 'Esta entry já está conciliada.' };
  }

  const tipoTransaction = entry.tipo === 'credito' ? 'receita' : 'despesa';
  const categoryId = body.categoryId !== undefined
    ? (body.categoryId || null)
    : (entry.suggestedCategoryId || null);

  // Se há categoria, puxa os campos de Domínio Contábil
  let dominioFields = {};
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (cat) {
      dominioFields = {
        contaDebito:  cat.contaDebito,
        contaCredito: cat.contaCredito,
        codHistorico: cat.codHistorico,
        centroCustoD: cat.centroCustoD,
        centroCustoC: cat.centroCustoC,
      };
    }
  }

  const descricaoBase = body.descricao || entry.descricao || entry.memo || '(sem descrição)';
  const complementoBase = body.complemento !== undefined
    ? (body.complemento || null)
    : (entry.descricao && entry.memo && entry.descricao !== entry.memo ? entry.memo : null);

  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    const novaTransaction = await tx.transaction.create({
      data: {
        tenantId,
        tipo:            tipoTransaction,
        descricao:       truncar(descricaoBase, 500),
        complemento:     truncar(complementoBase, 500),
        valor:           entry.valor,
        dataLancamento:  entry.dataMovimento,
        dataCompetencia: body.dataCompetencia ? new Date(body.dataCompetencia) : entry.dataMovimento,
        bankAccountId:   entry.bankAccountId,
        categoryId,
        status:          'realizado',
        origem:          'ofx',
        ofxImportId:     entry.ofxImportId,
        criadoPor:       userId,
        conciliadoEm:    agora,
        ...dominioFields,
      },
    });

    const updatedEntry = await tx.ofxEntry.update({
      where: { id: entryId },
      data:  {
        transactionId: novaTransaction.id,
        status:        'conciliado',
        conciliadoEm:  agora,
      },
      include: {
        transaction: {
          include: {
            category:    { select: { id: true, nome: true } },
            bankAccount: { select: { id: true, nome: true } },
          },
        },
      },
    });

    await recalcularContadoresImport(tx, entry.ofxImportId);

    return updatedEntry;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalcula os 3 contadores do OfxImport baseado no estado atual das entries.
 * Chamado depois de qualquer mudança de status de entry pra garantir consistência.
 */
async function recalcularContadoresImport(tx, ofxImportId) {
  const counts = await tx.ofxEntry.groupBy({
    by:    ['status'],
    where: { ofxImportId },
    _count: { _all: true },
  });
  const summary = { pendente: 0, conciliado: 0, ignorado: 0 };
  for (const c of counts) summary[c.status] = c._count._all;

  const total = summary.pendente + summary.conciliado + summary.ignorado;

  await tx.ofxImport.update({
    where: { id: ofxImportId },
    data:  {
      totalRegistros: total,
      conciliados:    summary.conciliado,
      pendentes:      summary.pendente,
    },
  });
}

/**
 * Detecta FITIDs duplicados em parsed.transactions e substitui por sintéticos.
 * Hash baseado em (fitid original + data + valor + tipo + descrição + memo + counter)
 * pra garantir unicidade dentro do arquivo e estabilidade entre re-imports
 * do mesmo conteúdo. Modifica o array in-place.
 *
 * Retorna o número de FITIDs que foram substituídos (informativo).
 */
function garantirFitidsUnicos(transactions) {
  const counts = new Map();
  for (const t of transactions) {
    counts.set(t.fitid, (counts.get(t.fitid) || 0) + 1);
  }
  const temDuplicatas = [...counts.values()].some((c) => c > 1);
  if (!temDuplicatas) return 0;

  const seen = new Map(); // fitid original -> próximo counter de aparição
  let substituidos = 0;
  for (const t of transactions) {
    if (counts.get(t.fitid) > 1) {
      const counter = seen.get(t.fitid) || 0;
      seen.set(t.fitid, counter + 1);
      const input = [
        t.fitid,
        t.dataMovimento ? t.dataMovimento.toISOString() : '',
        t.valor,
        t.tipo,
        t.memo || '',
        t.descricao || '',
        counter,
      ].join('|');
      const hash = crypto.createHash('sha256').update(input).digest('hex').slice(0, 24);
      t.fitidOriginal = t.fitid;
      t.fitid = `syn-${hash}`;
      substituidos += 1;
    }
  }
  return substituidos;
}

function truncar(s, max) {
  if (!s) return null;
  return s.length > max ? s.substring(0, max) : s;
}

function formatDateBR(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}


// ─────────────────────────────────────────────────────────────────────────────
// Criação em massa de lançamentos a partir de um import (Etapa 5C)
// ─────────────────────────────────────────────────────────────────────────────
async function bulkCreateFromImport(importId, tenantId, userId) {
  const entries = await prisma.ofxEntry.findMany({
    where:  {
      ofxImportId:   importId,
      tenantId,
      transactionId: null,
      ignoradoEm:    null,
    },
    select: { id: true },
  });

  if (!entries.length) return { created: 0, errors: 0, errorList: [] };

  let created = 0;
  let errors  = 0;
  const errorList = [];

  for (const e of entries) {
    try {
      await quickCreateFromEntry(e.id, tenantId, userId, {});
      created += 1;
    } catch (err) {
      errors += 1;
      errorList.push({ entryId: e.id, message: err.message || 'Erro desconhecido' });
    }
  }

  return { created, errors, errorList };
}

module.exports = {
  // 5A
  importFile,
  listImports,
  findImport,
  listEntries,
  removeImport,
  // 5B
  linkEntry,
  unlinkEntry,
  ignoreEntry,
  unignoreEntry,
  matchCandidates,
  quickCreateFromEntry, bulkCreateFromImport };
