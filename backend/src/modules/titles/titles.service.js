const prisma = require('../../config/database');

async function list(tenantId, filters = {}) {
  const { tipo, status, search, dateFrom, dateTo, page = 1, limit = 50 } = filters;
  const skip = (page - 1) * parseInt(limit);

  const where = {
    tenantId,
    ...(tipo   && { tipo }),
    ...(status && status !== '' ? { status } : {}),
    ...(dateFrom || dateTo ? {
      dataVencimento: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59') }),
      }
    } : {}),
    ...(search && {
      OR: [
        { descricao:      { contains: search, mode: 'insensitive' } },
        { nomeContato:    { contains: search, mode: 'insensitive' } },
        { numeroDocumento:{ contains: search, mode: 'insensitive' } },
      ]
    }),
  };

  const [data, total] = await Promise.all([
    prisma.title.findMany({
      where,
      include: { category: { select: { id: true, nome: true } } },
      orderBy: { dataVencimento: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.title.count({ where }),
  ]);

  return { data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
}

async function summary(tenantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pagarOpen, receberOpen, pagarVencido, receberVencido] = await Promise.all([
    prisma.title.aggregate({ where: { tenantId, tipo: 'pagar',   status: { in: ['aberto', 'parcial'] } }, _sum: { valor: true }, _count: true }),
    prisma.title.aggregate({ where: { tenantId, tipo: 'receber', status: { in: ['aberto', 'parcial'] } }, _sum: { valor: true }, _count: true }),
    prisma.title.aggregate({ where: { tenantId, tipo: 'pagar',   status: { in: ['aberto', 'parcial'] }, dataVencimento: { lt: today } }, _sum: { valor: true }, _count: true }),
    prisma.title.aggregate({ where: { tenantId, tipo: 'receber', status: { in: ['aberto', 'parcial'] }, dataVencimento: { lt: today } }, _sum: { valor: true }, _count: true }),
  ]);

  return {
    pagar:   { total: Number(pagarOpen._sum.valor   || 0), count: pagarOpen._count,   vencido: Number(pagarVencido._sum.valor   || 0), vencidoCount: pagarVencido._count },
    receber: { total: Number(receberOpen._sum.valor || 0), count: receberOpen._count, vencido: Number(receberVencido._sum.valor || 0), vencidoCount: receberVencido._count },
  };
}

async function findOne(id, tenantId) {
  const r = await prisma.title.findFirst({
    where: { id, tenantId },
    include: { category: true },
  });
  if (!r) throw { status: 404, message: 'Título não encontrado' };
  return r;
}

async function create(tenantId, userId, data) {
  const { tipo, descricao, valor, dataEmissao, dataVencimento, categoryId,
          numeroDocumento, nomeContato, observacao } = data;

  if (!tipo || !['pagar', 'receber'].includes(tipo)) throw { status: 400, message: 'Tipo inválido' };
  if (!descricao)      throw { status: 400, message: 'Descrição obrigatória' };
  if (!valor || valor <= 0) throw { status: 400, message: 'Valor inválido' };
  if (!dataVencimento) throw { status: 400, message: 'Data de vencimento obrigatória' };

  return prisma.title.create({
    data: {
      tenantId,
      tipo,
      descricao,
      valor,
      dataEmissao:    new Date(dataEmissao || dataVencimento),
      dataVencimento: new Date(dataVencimento),
      status: 'aberto',
      categoryId:      categoryId      || null,
      numeroDocumento: numeroDocumento || null,
      nomeContato:     nomeContato     || null,
      observacao:      observacao      || null,
      criadoPor: userId,
    },
    include: { category: true },
  });
}

async function update(id, tenantId, data) {
  const r = await findOne(id, tenantId);
  if (r.status === 'pago')      throw { status: 400, message: 'Título pago não pode ser editado' };
  if (r.status === 'cancelado') throw { status: 400, message: 'Título cancelado não pode ser editado' };

  const { descricao, valor, dataEmissao, dataVencimento, categoryId,
          numeroDocumento, nomeContato, observacao } = data;

  return prisma.title.update({
    where: { id },
    data: {
      ...(descricao       !== undefined && { descricao }),
      ...(valor           !== undefined && { valor }),
      ...(dataEmissao     !== undefined && { dataEmissao: new Date(dataEmissao) }),
      ...(dataVencimento  !== undefined && { dataVencimento: new Date(dataVencimento) }),
      ...(categoryId      !== undefined && { categoryId }),
      ...(numeroDocumento !== undefined && { numeroDocumento }),
      ...(nomeContato     !== undefined && { nomeContato }),
      ...(observacao      !== undefined && { observacao }),
    },
    include: { category: true },
  });
}

async function remove(id, tenantId) {
  const r = await findOne(id, tenantId);
  if (r.status === 'pago') throw { status: 400, message: 'Título pago não pode ser excluído' };
  await prisma.title.delete({ where: { id } });
  return { ok: true };
}

async function baixar(id, tenantId, userId, data) {
  const { dataPagamento, valorPago, bankAccountId, observacao } = data;

  if (!dataPagamento) throw { status: 400, message: 'Data de pagamento obrigatória' };
  if (!valorPago || valorPago <= 0) throw { status: 400, message: 'Valor pago inválido' };
  if (!bankAccountId) throw { status: 400, message: 'Conta bancária obrigatória' };

  const titulo = await findOne(id, tenantId);
  if (titulo.status === 'pago')      throw { status: 400, message: 'Título já baixado' };
  if (titulo.status === 'cancelado') throw { status: 400, message: 'Título cancelado' };

  const conta = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
  if (!conta) throw { status: 404, message: 'Conta bancária não encontrada' };

  const paidDate = new Date(dataPagamento);

  // Busca campos do Domínio da categoria
  let dominioFields = {};
  if (titulo.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: titulo.categoryId } });
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

  // Cria transação financeira
  const transaction = await prisma.transaction.create({
    data: {
      tenantId,
      bankAccountId,
      categoryId:    titulo.categoryId,
      tipo:          titulo.tipo === 'pagar' ? 'despesa' : 'receita',
      dataLancamento: paidDate,
      dataCompetencia: paidDate,
      valor:         valorPago,
      descricao:     titulo.descricao,
      complemento:   observacao || null,
      status:        'realizado',
      origem:        'titulo',
      criadoPor:     userId,
      ...dominioFields,
    },
  });

  // Atualiza título
  const isFullyPaid = parseFloat(valorPago) >= parseFloat(titulo.valor);
  return prisma.title.update({
    where: { id },
    data: {
      status:        isFullyPaid ? 'pago' : 'parcial',
      dataPagamento: paidDate,
      transactionId: transaction.id,
    },
    include: { category: true },
  });
}

async function cancelar(id, tenantId) {
  const r = await findOne(id, tenantId);
  if (r.status === 'pago') throw { status: 400, message: 'Título pago não pode ser cancelado' };
  return prisma.title.update({ where: { id }, data: { status: 'cancelado' } });
}

module.exports = { list, summary, findOne, create, update, remove, baixar, cancelar };
