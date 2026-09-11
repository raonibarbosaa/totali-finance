const prisma = require('../../config/database');
// Fonte única da definição de saldo — o extrato usa a MESMA regra das
// telas de contas e do dashboard.
const bankAccountsSvc = require('../bank-accounts/bank-accounts.service');
async function list(tenantId, filters={}) {
  const { tipo, status, bankAccountId, categoryId, search, dateFrom, dateTo, page=1, limit=50 } = filters;
  const skip = (page-1)*parseInt(limit);
  const where = { tenantId, ...(tipo&&{tipo}), ...(status&&{status}), ...(bankAccountId&&{bankAccountId}), ...(categoryId==='__sem__'?{categoryId:null,tipo:{not:'transferencia'}}:categoryId&&{categoryId}), ...(dateFrom||dateTo?{dataLancamento:{...(dateFrom&&{gte:new Date(dateFrom)}), ...(dateTo&&{lte:new Date(dateTo+"T23:59:59")})}}:{}), ...(search&&{OR:[{descricao:{contains:search,mode:"insensitive"}},{complemento:{contains:search,mode:"insensitive"}}]}) };
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({ where, include:{ category:{select:{id:true,nome:true}}, bankAccount:{select:{id:true,nome:true}}, customer:{select:{id:true,nome:true}}, supplier:{select:{id:true,nome:true}} }, orderBy:[{ dataLancamento:"desc" }, { criadoEm:"desc" }], skip, take:parseInt(limit) }),
    prisma.transaction.count({ where }),
  ]);
  return { data, total, page:parseInt(page), totalPages:Math.ceil(total/parseInt(limit)) };
}
async function create(tenantId, userId, data) {
  const { tipo, descricao, valor, dataLancamento, dataCompetencia, bankAccountId, categoryId, customerId, supplierId, complemento, status } = data;
  if (!tipo) throw { status:400, message:"Tipo obrigatório" };
  if (!descricao) throw { status:400, message:"Descrição obrigatória" };
  if (!valor||valor<=0) throw { status:400, message:"Valor inválido" };
  if (!dataLancamento) throw { status:400, message:"Data obrigatória" };

  // TRANSFERENCIA: cria 2 transacoes atomicamente
  if (tipo === "transferencia") {
    const { bankAccountIdOrigem, bankAccountIdDestino } = data;
    if (!bankAccountIdOrigem) throw { status:400, message:"Conta de origem obrigatória" };
    if (!bankAccountIdDestino) throw { status:400, message:"Conta de destino obrigatória" };
    if (bankAccountIdOrigem === bankAccountIdDestino) throw { status:400, message:"Origem e destino devem ser diferentes" };
    const v = parseFloat(valor);
    const dt = new Date(dataLancamento);
    const dc = dataCompetencia ? new Date(dataCompetencia) : dt;
    const baseData = { tenantId, valor: v, dataLancamento: dt, dataCompetencia: dc, complemento: complemento || null, status: status || "realizado", origem: "transferencia", criadoPor: userId };
    return prisma.$transaction([
      prisma.transaction.create({ data: { ...baseData, tipo: "despesa", descricao: "Transferencia (saida) " + descricao, bankAccountId: bankAccountIdOrigem }, include: { category: true, bankAccount: true } }),
      prisma.transaction.create({ data: { ...baseData, tipo: "receita", descricao: "Transferencia (entrada) " + descricao, bankAccountId: bankAccountIdDestino }, include: { category: true, bankAccount: true } }),
    ]);
  }

  let df = {};
  if (categoryId) {
    const cat = await prisma.category.findFirst({ where:{ id:categoryId, tenantId } });
    if (cat) df = { contaDebito:cat.contaDebito, contaCredito:cat.contaCredito, codHistorico:cat.codHistorico, centroCustoD:cat.centroCustoD, centroCustoC:cat.centroCustoC };
  }
  return prisma.transaction.create({ data:{ tenantId, tipo, descricao, valor:parseFloat(valor), dataLancamento:new Date(dataLancamento), dataCompetencia:dataCompetencia?new Date(dataCompetencia):new Date(dataLancamento), bankAccountId:bankAccountId||null, categoryId:categoryId||null, customerId:customerId||null, supplierId:supplierId||null, complemento:complemento||null, status:status||"realizado", origem:"manual", criadoPor:userId, ...df }, include:{category:true,bankAccount:true,customer:true,supplier:true} });
}
async function update(id, tenantId, data) {
  const r = await prisma.transaction.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:"Lançamento não encontrado" };
  if (r.exportado) throw { status:400, message:"Lançamento exportado não pode ser editado" };
  const { bankAccountIdOrigem, bankAccountIdDestino, ...rest } = data;
  const sanitized = {
    ...rest,
    ...(rest.valor !== undefined && { valor: parseFloat(rest.valor) }),
    ...(rest.dataLancamento !== undefined && { dataLancamento: new Date(rest.dataLancamento) }),
    ...(rest.dataCompetencia !== undefined && { dataCompetencia: rest.dataCompetencia ? new Date(rest.dataCompetencia) : null }),
    ...(rest.categoryId !== undefined && { categoryId: rest.categoryId || null }),
    ...(rest.bankAccountId !== undefined && { bankAccountId: rest.bankAccountId || null }),
    ...(rest.customerId !== undefined && { customerId: rest.customerId || null }),
    ...(rest.supplierId !== undefined && { supplierId: rest.supplierId || null }),
  };
  return prisma.transaction.update({ where:{id}, data: sanitized, include:{category:true,bankAccount:true,customer:true,supplier:true} });
}
async function remove(id, tenantId) {
  const r = await prisma.transaction.findFirst({ where:{ id, tenantId } });
  if (!r) throw { status:404, message:"Lançamento não encontrado" };
  if (r.exportado) throw { status:400, message:"Lançamento exportado não pode ser excluído" };
  await prisma.transaction.delete({ where:{id} });
  return { ok:true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extrato bancário (Etapa 5A) — usado pela página cliente/Extrato.jsx
//
// Calcula saldo anterior, saldo final, totais e saldo running por lançamento
// para uma conta bancária num período.
//
// Considera os status efetivados ('realizado' e 'conciliado'), a mesma regra
// de bank-accounts.service. Antes o extrato contava só 'realizado', então um
// lançamento conciliado sumia daqui mas continuava no card de saldo da tela de
// contas, e os dois números não batiam.
//
// Transferências (que existem no DB como pares despesa+receita em contas
// distintas) já são contabilizadas corretamente pelo filtro por conta.
// ─────────────────────────────────────────────────────────────────────────────
async function extrato(tenantId, filters = {}) {
  const { bankAccountId, dataInicio, dataFim } = filters;
  if (!bankAccountId) throw { status: 400, message: 'Conta bancária obrigatória' };
  if (!dataInicio || !dataFim) throw { status: 400, message: 'Período obrigatório (dataInicio, dataFim)' };

  const conta = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId },
  });
  if (!conta) throw { status: 404, message: 'Conta bancária não encontrada' };

  const inicio = new Date(dataInicio);
  const fim    = new Date(dataFim + 'T23:59:59');

  // Saldo anterior = saldo da conta na véspera do início do período.
  // Delegado para a fonte única, em vez de recalcular com regra própria.
  const vespera = new Date(inicio);
  vespera.setDate(vespera.getDate() - 1);
  vespera.setHours(23, 59, 59, 999);

  const { saldo: saldoAnterior } = await bankAccountsSvc.saldoNaData(
    tenantId, bankAccountId, vespera
  );

  // Transações dentro do período
  const lancamentos = await prisma.transaction.findMany({
    where: {
      tenantId,
      bankAccountId,
      status: { in: bankAccountsSvc.STATUS_EFETIVADOS },
      dataLancamento: {
        gte: inicio,
        lte: fim,
        // Respeita a data do saldo inicial, igual ao cálculo do saldo anterior.
        ...(conta.dataSaldoInicial && { gte: new Date(Math.max(inicio, new Date(conta.dataSaldoInicial))) }),
      },
    },
    include: {
      category:    { select: { id: true, nome: true } },
      bankAccount: { select: { id: true, nome: true } },
    },
    orderBy: [{ dataLancamento: 'asc' }, { criadoEm: 'asc' }],
  });

  // Saldo running e totais
  //
  // O ajuste de saldo CONTA nos totais de propósito. A tela mostra, na mesma
  // linha, saldo anterior, entradas, saídas e saldo final, e essa conta precisa
  // fechar. Tirar o ajuste só das entradas e saídas deixaria o rodapé errado.
  //
  // Para que ele não fique escondido no meio, `totalAjustes` informa à parte
  // quanto do período veio de acerto manual — líquido, já com sinal.
  let saldoRolling  = saldoAnterior;
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalAjustes  = 0;
  const lancamentosComSaldo = lancamentos.map((l) => {
    const v = parseFloat(l.valor);
    if (l.tipo === 'receita') {
      saldoRolling += v;
      totalReceitas += v;
      if (l.origem === 'ajuste') totalAjustes += v;
    } else if (l.tipo === 'despesa') {
      saldoRolling -= v;
      totalDespesas += v;
      if (l.origem === 'ajuste') totalAjustes -= v;
    }
    return { ...l, valor: v, saldo: Number(saldoRolling.toFixed(2)) };
  });

  return {
    bankAccount:   { id: conta.id, nome: conta.nome, banco: conta.banco, agencia: conta.agencia, conta: conta.conta },
    periodo:       { dataInicio, dataFim },
    saldoAnterior: Number(saldoAnterior.toFixed(2)),
    totalReceitas: Number(totalReceitas.toFixed(2)),
    totalDespesas: Number(totalDespesas.toFixed(2)),
    // Parcela dos totais acima que veio de ajuste de saldo (líquido, com sinal).
    totalAjustes:  Number(totalAjustes.toFixed(2)),
    saldoFinal:    Number(saldoRolling.toFixed(2)),
    lancamentos:   lancamentosComSaldo,
  };
}

module.exports = { list, create, update, remove, extrato };
