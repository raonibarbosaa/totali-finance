// backend/src/modules/titles/titles.service.js
// Etapa 4.1 (parcelamento) + Etapa 4.2 (supplier/customer)
//
// Mudanças vs. versão anterior:
//   - create() detecta `parcelamento` no body e cria N títulos em transação
//   - create() aceita supplierId/customerId, valida e replica nome em nomeContato
//   - update() permite trocar supplierId/customerId (com mesma replicação)
//   - list/findOne incluem supplier e customer no select
//   - nova função removeGrupo(grupoId, tenantId) — remove parcelas em aberto

const crypto = require('crypto');
const prisma = require('../../config/database');
const recurringSvc = require('../recurring-titles/recurring-titles.service');

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Zera a hora de uma data (comparações de vencimento são por DIA). */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Primeiro dia do mês da data — chave de competência em period_closings.
 *
 * Usa getters UTC de propósito. dataVencimento e competencia são colunas
 * @db.Date, e o Prisma devolve DATE como meia-noite UTC. Ler com getMonth()
 * local jogaria a data para o dia anterior em fuso negativo (o Brasil é
 * UTC-3), e como competencia é sempre dia 1, o mês voltaria um inteiro —
 * agosto viraria julho e o fechamento nunca casaria.
 */
function competenciaDe(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
}

/**
 * Calcula as N parcelas a partir do valor total.
 * Trabalha em centavos para evitar erro de float; centavos de resto
 * vão somados na ÚLTIMA parcela.
 *
 * @returns Array<{ numero, total, valor: number, vencimento: Date }>
 */
function calcularParcelas({ valorTotal, numeroParcelas, primeiroVencimento, intervaloDias }) {
  const n = parseInt(numeroParcelas, 10);
  if (!Number.isFinite(n) || n < 1) throw { status: 400, message: 'numeroParcelas deve ser >= 1' };

  const intervalo = parseInt(intervaloDias, 10);
  if (!Number.isFinite(intervalo) || intervalo < 1) throw { status: 400, message: 'intervaloDias deve ser >= 1' };

  const totalCentavos = Math.round(Number(valorTotal) * 100);
  if (!Number.isFinite(totalCentavos) || totalCentavos <= 0) {
    throw { status: 400, message: 'valorTotal deve ser > 0' };
  }

  const base  = Math.floor(totalCentavos / n);
  const resto = totalCentavos - (base * n);

  const dataInicial = new Date(primeiroVencimento);
  if (isNaN(dataInicial.getTime())) throw { status: 400, message: 'primeiroVencimento inválido' };

  const parcelas = [];
  for (let i = 0; i < n; i++) {
    const cents = (i === n - 1) ? base + resto : base;
    const venc = new Date(dataInicial);
    venc.setDate(venc.getDate() + (intervalo * i));
    parcelas.push({
      numero:     i + 1,
      total:      n,
      valor:      cents / 100,
      vencimento: venc,
    });
  }
  return parcelas;
}

/**
 * Resolve supplierId/customerId: valida tenant e devolve nome para
 * replicar em nomeContato. Lança se id existir mas não pertencer ao tenant.
 */
async function resolverContato({ tenantId, supplierId, customerId }) {
  let nomeReplicado = null;

  if (supplierId) {
    const sup = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, ativo: true },
      select: { nome: true },
    });
    if (!sup) throw { status: 404, message: 'Fornecedor não encontrado' };
    nomeReplicado = sup.nome;
  }

  if (customerId) {
    const cus = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, ativo: true },
      select: { nome: true },
    });
    if (!cus) throw { status: 404, message: 'Cliente não encontrado' };
    // Se vier os dois, customer vence (caso raro; UX deveria evitar)
    nomeReplicado = cus.nome;
  }

  return nomeReplicado;
}

const includePadrao = {
  category:     true,
  bankAccount:  true,
  supplier:     { select: { id: true, nome: true, documento: true, tipoDocumento: true } },
  customer:     { select: { id: true, nome: true, documento: true, tipoDocumento: true } },
  // Necessário para o frontend avisar que excluir um título de recorrência
  // ATIVA é inútil: a geração lazy recria a ocorrência na próxima listagem.
  recurringTitle: { select: { id: true, ativo: true, descricao: true } },
};

// ─── list / summary / findOne ────────────────────────────────────────────

async function list(tenantId, filters = {}) {
  // Geração lazy de ocorrências de recorrência (Etapa 3.x).
  // Falhas aqui não derrubam a listagem.
  try {
    await recurringSvc.gerarOcorrenciasPendentes(tenantId);
  } catch (e) {
    console.error('[titles.list] Falha em gerarOcorrenciasPendentes:', e.message);
  }

  const {
    tipo, status, search,
    dateFrom, dateTo,
    supplierId, customerId, grupoParcelamentoId,
    page = 1, limit = 50,
  } = filters;

  const lim  = Math.min(parseInt(limit, 10) || 50, 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

  // "vencido" é um PSEUDO-status: não existe na coluna status do banco.
  // Traduz para (aberto|parcial) + dataVencimento < hoje.
  const filtroVencido = status === 'vencido';
  const hoje = startOfDay(new Date());

  // Um único objeto de intervalo combina período escolhido + corte de vencidos,
  // para os dois filtros conviverem sem um sobrescrever o outro.
  const vencRange = {
    ...(dateFrom      && { gte: new Date(dateFrom) }),
    ...(dateTo        && { lte: new Date(dateTo) }),
    ...(filtroVencido && { lt: hoje }),
  };

  const where = {
    tenantId,
    ...(tipo                && { tipo }),
    ...(status && !filtroVencido && { status }),
    ...(filtroVencido       && { status: { in: ['aberto', 'parcial'] } }),
    ...(supplierId          && { supplierId }),
    ...(customerId          && { customerId }),
    ...(grupoParcelamentoId && { grupoParcelamentoId }),
    ...(Object.keys(vencRange).length > 0 && { dataVencimento: vencRange }),
    ...(search && {
      OR: [
        { descricao:       { contains: search, mode: 'insensitive' } },
        { nomeContato:     { contains: search, mode: 'insensitive' } },
        { numeroDocumento: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.title.findMany({
      where,
      include: includePadrao,
      orderBy: [{ dataVencimento: 'asc' }, { criadoEm: 'desc' }],
      skip,
      take: lim,
    }),
    prisma.title.count({ where }),
  ]);

  return {
    data,
    total,
    page: parseInt(page, 10) || 1,
    totalPages: Math.ceil(total / lim) || 1,
  };
}

async function summary(tenantId, filters = {}) {
  const { dateFrom, dateTo } = filters;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  // Range de período (se informado) aplica em dataVencimento
  const dataVencRange = (dateFrom || dateTo)
    ? {
        dataVencimento: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      }
    : {};

  // "Vencidos": dataVencimento < hoje, opcionalmente cortado pelo período
  const dataVencidoRange = {
    dataVencimento: {
      lt: hoje,
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
    },
  };

  // 'parcial' também conta como aberto
  const baseAberto = { tenantId, status: { in: ['aberto', 'parcial'] } };

  const [pagarOpen, receberOpen, pagarVencido, receberVencido] = await Promise.all([
    prisma.title.aggregate({
      where: { ...baseAberto, tipo: 'pagar', ...dataVencRange },
      _sum: { valor: true }, _count: true,
    }),
    prisma.title.aggregate({
      where: { ...baseAberto, tipo: 'receber', ...dataVencRange },
      _sum: { valor: true }, _count: true,
    }),
    prisma.title.aggregate({
      where: { ...baseAberto, tipo: 'pagar', ...dataVencidoRange },
      _sum: { valor: true }, _count: true,
    }),
    prisma.title.aggregate({
      where: { ...baseAberto, tipo: 'receber', ...dataVencidoRange },
      _sum: { valor: true }, _count: true,
    }),
  ]);

  return {
    pagar: {
      total:        Number(pagarOpen._sum.valor   || 0),
      count:        pagarOpen._count,
      vencido:      Number(pagarVencido._sum.valor  || 0),
      vencidoCount: pagarVencido._count,
    },
    receber: {
      total:        Number(receberOpen._sum.valor   || 0),
      count:        receberOpen._count,
      vencido:      Number(receberVencido._sum.valor  || 0),
      vencidoCount: receberVencido._count,
    },
  };
}

async function findOne(id, tenantId) {
  const titulo = await prisma.title.findFirst({
    where: { id, tenantId },
    include: includePadrao,
  });
  if (!titulo) throw { status: 404, message: 'Título não encontrado' };
  return titulo;
}

// ─── create (com parcelamento + supplier/customer) ───────────────────────

async function create(tenantId, userId, data) {
  const {
    tipo, descricao, valor,
    dataEmissao, dataVencimento,
    categoryId, bankAccountId,
    numeroDocumento, nomeContato, observacao,
    supplierId, customerId,
    parcelamento, // { ativo, numeroParcelas, intervaloDias }
  } = data;

  // Validações básicas
  if (!tipo || !['pagar', 'receber'].includes(tipo)) {
    throw { status: 400, message: 'Tipo inválido (pagar ou receber)' };
  }
  if (!descricao || !descricao.trim()) throw { status: 400, message: 'Descrição obrigatória' };
  if (!valor || Number(valor) <= 0)    throw { status: 400, message: 'Valor deve ser maior que zero' };
  if (!dataVencimento)                 throw { status: 400, message: 'Data de vencimento obrigatória' };

  // Categoria (se informada) precisa pertencer ao tenant
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true },
    });
    if (!cat) throw { status: 404, message: 'Categoria não encontrada' };
  }

  // Conta bancária (se informada) precisa pertencer ao tenant
  if (bankAccountId) {
    const ba = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId },
      select: { id: true },
    });
    if (!ba) throw { status: 404, message: 'Conta bancária não encontrada' };
  }

  // Supplier/Customer: valida e captura nome para replicar
  const nomeReplicado = await resolverContato({ tenantId, supplierId, customerId });
  const nomeContatoFinal = nomeContato?.trim() || nomeReplicado || null;

  // Dados comuns a todas as parcelas (tudo MENOS valor/vencimento/parcelaXxx)
  const baseData = {
    tenantId,
    tipo,
    descricao:        descricao.trim(),
    dataEmissao:      dataEmissao ? new Date(dataEmissao) : new Date(),
    categoryId:       categoryId       || null,
    bankAccountId:    bankAccountId    || null,
    numeroDocumento:  numeroDocumento  || null,
    nomeContato:      nomeContatoFinal,
    observacao:       observacao       || null,
    supplierId:       supplierId       || null,
    customerId:       customerId       || null,
    status:           'aberto',
    criadoPor:        userId,
  };

  // ───── Caminho 1: lançamento à vista (sem parcelamento ou N=1) ─────
  const querParcelar = parcelamento?.ativo && parseInt(parcelamento.numeroParcelas, 10) > 1;

  if (!querParcelar) {
    return prisma.title.create({
      data: {
        ...baseData,
        valor:          Number(valor),
        dataVencimento: new Date(dataVencimento),
      },
      include: includePadrao,
    });
  }

  // ───── Caminho 2: parcelado ─────
  const parcelas = calcularParcelas({
    valorTotal:         valor,
    numeroParcelas:     parcelamento.numeroParcelas,
    primeiroVencimento: dataVencimento,
    intervaloDias:      parcelamento.intervaloDias || 30,
  });

  const grupoId = crypto.randomUUID();
  const totalGrupo = parcelas.length;
  const valorTotalGrupo = Number(valor);
  const descBase = baseData.descricao;

  const criadas = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const p of parcelas) {
      const novo = await tx.title.create({
        data: {
          ...baseData,
          descricao:           `${descBase} (${p.numero}/${p.total})`,
          valor:               p.valor,
          dataVencimento:      p.vencimento,
          grupoParcelamentoId: grupoId,
          parcelaNumero:       p.numero,
          parcelaTotal:        p.total,
          valorTotalGrupo,
        },
        include: includePadrao,
      });
      out.push(novo);
    }
    return out;
  });

  return {
    grupoParcelamentoId: grupoId,
    parcelaTotal:        totalGrupo,
    valorTotalGrupo,
    titles:              criadas,
  };
}

// ─── update / remove / removeGrupo ───────────────────────────────────────

async function update(id, tenantId, data) {
  const titulo = await findOne(id, tenantId);
  if (titulo.status === 'pago')      throw { status: 400, message: 'Título já pago não pode ser editado' };
  if (titulo.status === 'cancelado') throw { status: 400, message: 'Título cancelado não pode ser editado' };

  const {
    descricao, valor, dataEmissao, dataVencimento,
    categoryId, bankAccountId,
    numeroDocumento, nomeContato, observacao,
    supplierId, customerId,
  } = data;

  // Se trocou supplier/customer, valida e re-captura nome
  let nomeReplicado;
  const trocouSupplier = supplierId !== undefined && supplierId !== titulo.supplierId;
  const trocouCustomer = customerId !== undefined && customerId !== titulo.customerId;
  if (trocouSupplier || trocouCustomer) {
    nomeReplicado = await resolverContato({
      tenantId,
      supplierId: supplierId !== undefined ? supplierId : titulo.supplierId,
      customerId: customerId !== undefined ? customerId : titulo.customerId,
    });
  }

  return prisma.title.update({
    where: { id },
    data: {
      ...(descricao        !== undefined && { descricao: descricao.trim() }),
      ...(valor            !== undefined && { valor: Number(valor) }),
      ...(dataEmissao      !== undefined && { dataEmissao: new Date(dataEmissao) }),
      ...(dataVencimento   !== undefined && { dataVencimento: new Date(dataVencimento) }),
      ...(categoryId       !== undefined && { categoryId:    categoryId    || null }),
      ...(bankAccountId    !== undefined && { bankAccountId: bankAccountId || null }),
      ...(numeroDocumento  !== undefined && { numeroDocumento: numeroDocumento || null }),
      ...(observacao       !== undefined && { observacao:      observacao      || null }),
      ...(supplierId       !== undefined && { supplierId:      supplierId      || null }),
      ...(customerId       !== undefined && { customerId:      customerId      || null }),
      // nomeContato: se vier explícito, usa; senão, se trocou contato, replica novo nome
      ...(nomeContato !== undefined
            ? { nomeContato: nomeContato?.trim() || null }
            : (nomeReplicado !== undefined ? { nomeContato: nomeReplicado } : {})),
    },
    include: includePadrao,
  });
}

async function remove(id, tenantId) {
  const titulo = await findOne(id, tenantId);
  if (titulo.status === 'pago') throw { status: 400, message: 'Título pago não pode ser excluído' };
  await prisma.title.delete({ where: { id } });
  return { ok: true };
}

/**
 * Remove em lote todas as parcelas EM ABERTO de um grupo.
 * Parcelas pagas/canceladas são preservadas.
 */
async function removeGrupo(grupoId, tenantId) {
  if (!grupoId) throw { status: 400, message: 'grupoId obrigatório' };

  // Conta o que existe para dar feedback
  const [emAberto, total] = await Promise.all([
    prisma.title.count({ where: { tenantId, grupoParcelamentoId: grupoId, status: 'aberto' } }),
    prisma.title.count({ where: { tenantId, grupoParcelamentoId: grupoId } }),
  ]);

  if (total === 0) throw { status: 404, message: 'Grupo de parcelamento não encontrado' };

  const result = await prisma.title.deleteMany({
    where: { tenantId, grupoParcelamentoId: grupoId, status: 'aberto' },
  });

  return {
    ok:          true,
    excluidas:   result.count,
    preservadas: total - emAberto,
  };
}

// ─── Ações em lote ───────────────────────────────────────────────────────
//
// Regra de ouro: NUNCA apagar título com pagamento registrado.
//
// `transactionId` não é uma FK no schema (é String? solto), então o banco NÃO
// impede apagar um título pago. Só que a Transaction da baixa ficaria órfã,
// continuando a contar em saldo, DRE e exportação pro Domínio sem título de
// origem. Por isso a filtragem por status é feita aqui, no service.
//
// Em vez de derrubar a operação inteira quando há item inelegível, seguimos o
// padrão de removeGrupo(): apaga o que pode, devolve o que preservou e o motivo.

// Teto de ids por chamada. O axios do frontend tem timeout de 15s; um lote
// muito grande estouraria o cliente antes do banco responder.
const LOTE_MAX = 200;

/**
 * Carrega os títulos do lote e classifica cada um em elegível ou preservado.
 * Compartilhado por removeLote e cancelarLote.
 *
 * @param statusElegiveis  status que a operação aceita processar
 */
async function classificarLote(tenantId, ids, statusElegiveis) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw { status: 400, message: 'Selecione pelo menos um título' };
  }
  if (ids.length > LOTE_MAX) {
    throw { status: 400, message: `Selecione no máximo ${LOTE_MAX} títulos por vez` };
  }

  // Filtrar por tenantId é o que garante o isolamento entre empresas: ids de
  // outra empresa simplesmente não voltam da consulta.
  const titulos = await prisma.title.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, descricao: true, status: true, dataVencimento: true },
  });

  if (titulos.length === 0) {
    throw { status: 404, message: 'Nenhum título encontrado' };
  }

  // Competências fechadas do tenant. O periodGuard só inspeciona
  // dataLancamento/dataPagamento no body, então não cobre estas rotas — a
  // validação de competência precisa morar aqui.
  const fechamentos = await prisma.periodClosing.findMany({
    where:  { tenantId, status: 'fechado' },
    select: { competencia: true },
  });
  const competenciasFechadas = new Set(
    fechamentos.map(f => competenciaDe(f.competencia).getTime())
  );

  const elegiveis   = [];
  const preservados = [];

  const MOTIVO_STATUS = {
    pago:      'título pago',
    parcial:   'pagamento parcial registrado',
    cancelado: 'já cancelado',
    aberto:    'em aberto',
  };

  for (const t of titulos) {
    if (!statusElegiveis.includes(t.status)) {
      preservados.push({
        id: t.id,
        descricao: t.descricao,
        motivo: MOTIVO_STATUS[t.status] || `status ${t.status}`,
      });
      continue;
    }

    if (competenciasFechadas.has(competenciaDe(t.dataVencimento).getTime())) {
      preservados.push({
        id: t.id,
        descricao: t.descricao,
        motivo: 'competência fechada',
      });
      continue;
    }

    elegiveis.push(t);
  }

  return { elegiveis, preservados };
}

/**
 * Exclui em lote. Só toca em títulos 'aberto' — pago, parcial e cancelado são
 * preservados, assim como vencimento em competência fechada.
 */
async function removeLote(tenantId, ids) {
  const { elegiveis, preservados } = await classificarLote(tenantId, ids, ['aberto']);

  let excluidos = 0;
  if (elegiveis.length > 0) {
    const r = await prisma.title.deleteMany({
      where: { tenantId, id: { in: elegiveis.map(t => t.id) } },
    });
    excluidos = r.count;
  }

  return { ok: true, excluidos, preservados };
}

/**
 * Cancela em lote. Espelha as validações do cancelar() individual: aceita
 * 'aberto' e 'parcial', recusa pago e já cancelado. Não desfaz baixa alguma —
 * para isso existe o estornar().
 */
async function cancelarLote(tenantId, ids) {
  const { elegiveis, preservados } = await classificarLote(
    tenantId, ids, ['aberto', 'parcial']
  );

  let cancelados = 0;
  if (elegiveis.length > 0) {
    const r = await prisma.title.updateMany({
      where: { tenantId, id: { in: elegiveis.map(t => t.id) } },
      data:  { status: 'cancelado' },
    });
    cancelados = r.count;
  }

  return { ok: true, cancelados, preservados };
}

// ─── baixar / cancelar / estornar (preservadas da versão anterior) ───────

async function baixar(id, tenantId, userId, dadosBaixa) {
  const { dataPagamento, valorPago, bankAccountId, observacao: obsBaixa } = dadosBaixa || {};

  if (!dataPagamento)                        throw { status: 400, message: 'Data de pagamento obrigatória' };
  if (!valorPago || Number(valorPago) <= 0)  throw { status: 400, message: 'Valor pago deve ser maior que zero' };
  if (!bankAccountId)                        throw { status: 400, message: 'Conta bancária obrigatória' };

  const titulo = await findOne(id, tenantId);
  if (titulo.status === 'pago')      throw { status: 400, message: 'Título já está pago' };
  if (titulo.status === 'cancelado') throw { status: 400, message: 'Título cancelado não pode ser baixado' };

  const ba = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId },
    select: { id: true },
  });
  if (!ba) throw { status: 404, message: 'Conta bancária não encontrada' };

  const dtPag = new Date(dataPagamento);

  // Herda a codificação contábil da categoria.
  //
  // Os nomes aqui estavam todos errados: o código lia dominioContaDebito e
  // companhia, que NÃO existem em Category. O Prisma recusava a consulta e a
  // baixa falhava sempre — o botão Pagar não funcionava.
  let dominioFields = {};
  if (titulo.categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: titulo.categoryId },
      select: {
        contaDebito:  true,
        contaCredito: true,
        codHistorico: true,
        centroCustoD: true,
        centroCustoC: true,
      },
    });
    if (cat) dominioFields = cat;
  }

  // Pagamento total ou parcial?
  const isFullyPaid = Number(valorPago) >= Number(titulo.valor);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        // 'pagar' vira despesa e 'receber' vira receita. Antes estava
        // 'saida'/'entrada', que nenhum filtro do sistema reconhece.
        tipo:           titulo.tipo === 'pagar' ? 'despesa' : 'receita',
        descricao:      titulo.descricao,
        valor:          Number(valorPago),
        dataLancamento: dtPag,
        // Competência é uma DATA, não mês e ano separados. Na baixa ela é a
        // própria data do pagamento: regime de caixa.
        dataCompetencia: dtPag,
        bankAccountId,
        categoryId:     titulo.categoryId,
        status:         'realizado',
        // Transaction não tem numeroDocumento nem nomeContato. O que era
        // gravado neles ia junto com a observação, e agora vai no complemento,
        // que é o campo de texto livre que existe de verdade.
        complemento:    [
          titulo.numeroDocumento && `Doc: ${titulo.numeroDocumento}`,
          titulo.nomeContato,
          obsBaixa,
        ].filter(Boolean).join(' · ') || null,
        supplierId:     titulo.supplierId || null,
        customerId:     titulo.customerId || null,
        origem:         'titulo',
        criadoPor:      userId,
        ...dominioFields,
      },
    });

    return tx.title.update({
      where: { id },
      data: {
        status:        isFullyPaid ? 'pago' : 'parcial',
        dataPagamento: dtPag,
        transactionId: transaction.id,
      },
      include: includePadrao,
    });
  });
}

async function cancelar(id, tenantId) {
  const titulo = await findOne(id, tenantId);
  if (titulo.status === 'pago')      throw { status: 400, message: 'Título pago não pode ser cancelado' };
  if (titulo.status === 'cancelado') throw { status: 400, message: 'Título já está cancelado' };

  return prisma.title.update({
    where: { id },
    data:  { status: 'cancelado' },
    include: includePadrao,
  });
}

async function estornar(id, tenantId) {
  const titulo = await findOne(id, tenantId);

  if (titulo.status !== 'pago' && titulo.status !== 'parcial') {
    throw { status: 400, message: 'Apenas títulos pagos ou parciais podem ser estornados' };
  }
  if (!titulo.transactionId) {
    throw { status: 400, message: 'Título não possui transação vinculada para estornar' };
  }

  // Busca a transação — se não existir mais (inconsistência), só limpa o título
  const transaction = await prisma.transaction.findFirst({
    where: { id: titulo.transactionId, tenantId },
  });
  if (!transaction) {
    return prisma.title.update({
      where: { id },
      data:  { status: 'aberto', dataPagamento: null, transactionId: null },
      include: includePadrao,
    });
  }

  // Bloqueio: já exportado pro Domínio
  if (transaction.exportado) {
    throw {
      status:  400,
      message: 'Este título já foi exportado para o Domínio. Estorno não é possível — entre em contato com o contador.',
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id: titulo.transactionId } });
    return tx.title.update({
      where: { id },
      data: {
        status:        'aberto',
        dataPagamento: null,
        transactionId: null,
      },
      include: includePadrao,
    });
  });
}

module.exports = {
  list, summary, findOne,
  create, update, remove, removeGrupo,
  removeLote, cancelarLote,
  baixar, cancelar, estornar,
  // expostos para testes
  calcularParcelas,
};
