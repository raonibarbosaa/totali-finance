// ─────────────────────────────────────────────────────────────────────────
// balance-adjustments.service.js
//
// Ajuste de saldo bancário auditável.
//
// PROBLEMA QUE RESOLVE
// Quando o cliente para de lançar, o saldo do sistema se afasta do saldo real
// do banco. Antes, a única saída era editar o saldoInicial da conta: sem
// registro de quem mudou nem por quê, reescrevendo retroativamente o extrato
// de todos os períodos, e sem virar lançamento para a contabilidade.
//
// COMO FUNCIONA
// O saldo não existe como coluna — é sempre derivado de
// saldoInicial + Σ receitas − Σ despesas. Logo não há número para sobrescrever.
// O ajuste é um Transaction de verdade, com origem='ajuste', mais um registro
// nesta tabela guardando o antes, o depois e o motivo.
//
// O QUE O AJUSTE NÃO FAZ
// Não entra no DRE nem no DFC. Ele representa movimentação de natureza
// desconhecida, e lançá-lo como receita inflaria a base de imposto em Simples
// e Presumido. O filtro fica em reports.service.js e dashboard.routes.js,
// ancorado em origem='ajuste'.
// ─────────────────────────────────────────────────────────────────────────

const prisma          = require('../../config/database');
const bankAccountsSvc = require('../bank-accounts/bank-accounts.service');

// Marcador que tira o lançamento dos relatórios. Mudar aqui exige mudar
// também os filtros em reports.service.js e dashboard.routes.js.
const ORIGEM_AJUSTE = 'ajuste';

// Motivo curto demais não é justificativa. Evita "ajuste" e "ok" como
// explicação de um lançamento que altera o saldo do cliente.
const MOTIVO_MIN = 10;

const fmtData = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const includePadrao = {
  bankAccount: { select: { id: true, nome: true, banco: true } },
  criador:     { select: { id: true, nome: true, email: true } },
};

// ─────────────────────────────────────────────────────────────────────────
// Validações
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recusa lançamento em competência fechada.
 *
 * O periodGuard já cobre a rota, mas ele depende do campo se chamar
 * dataLancamento no body e falha em SILÊNCIO se o nome mudar. Como aqui se
 * trata de saldo de cliente, a checagem é repetida no service.
 */
async function exigirCompetenciaAberta(tenantId, data) {
  const d = new Date(data);
  const competencia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

  const fechamento = await prisma.periodClosing.findUnique({
    where: { tenantId_competencia: { tenantId, competencia } },
  });

  if (fechamento && fechamento.status === 'fechado') {
    const mes = competencia.toLocaleDateString('pt-BR', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    throw {
      status: 422,
      code: 'PERIOD_CLOSED',
      message: `A competência de ${mes} está fechada. Reabra a competência para ajustar o saldo desse mês.`,
    };
  }
}

/**
 * A categoria é obrigatória por causa da exportação para o Domínio:
 * export.service.js descarta em SILÊNCIO todo lançamento sem conta de débito
 * e crédito. Sem categoria, o ajuste sumiria do arquivo e o saldo do sistema
 * deixaria de bater com o Domínio.
 */
async function carregarCategoria(categoryId, tenantId) {
  if (!categoryId) {
    throw { status: 400, message: 'Categoria obrigatória para o ajuste aparecer na exportação contábil' };
  }
  const cat = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!cat) throw { status: 404, message: 'Categoria não encontrada' };

  if (!cat.contaDebito || !cat.contaCredito) {
    throw {
      status: 400,
      message:
        `A categoria "${cat.nome}" não tem conta de débito e crédito configuradas. ` +
        'Sem elas o ajuste não sai na exportação para o Domínio.',
    };
  }
  return cat;
}

/** Snapshot das contas contábeis, no mesmo formato de transactions.service. */
const contabilDaCategoria = (cat) => ({
  contaDebito:  cat.contaDebito,
  contaCredito: cat.contaCredito,
  codHistorico: cat.codHistorico,
  centroCustoD: cat.centroCustoD,
  centroCustoC: cat.centroCustoC,
});

// ─────────────────────────────────────────────────────────────────────────
// Consulta
// ─────────────────────────────────────────────────────────────────────────

/**
 * Prévia para a tela: quanto o sistema diz que a conta tem numa data.
 * Usa a MESMA função de saldo das telas de contas e do extrato.
 */
async function previa(tenantId, bankAccountId, data) {
  if (!bankAccountId) throw { status: 400, message: 'Conta bancária obrigatória' };
  if (!data)          throw { status: 400, message: 'Data obrigatória' };

  const { conta, saldo, receitas, despesas } =
    await bankAccountsSvc.saldoNaData(tenantId, bankAccountId, new Date(data + 'T23:59:59'));

  return {
    bankAccount:  { id: conta.id, nome: conta.nome, banco: conta.banco },
    data,
    saldoSistema: saldo,
    receitas,
    despesas,
  };
}

async function list(tenantId, filters = {}) {
  const { bankAccountId } = filters;
  return prisma.balanceAdjustment.findMany({
    where: { tenantId, ...(bankAccountId && { bankAccountId }) },
    include: includePadrao,
    orderBy: [{ dataAjuste: 'desc' }, { criadoEm: 'desc' }],
  });
}

async function findOne(id, tenantId) {
  const r = await prisma.balanceAdjustment.findFirst({
    where: { id, tenantId },
    include: includePadrao,
  });
  if (!r) throw { status: 404, message: 'Ajuste não encontrado' };
  return r;
}

// ─────────────────────────────────────────────────────────────────────────
// Criação
// ─────────────────────────────────────────────────────────────────────────

/**
 * Grava o par lançamento + registro de auditoria, atomicamente.
 * Usado tanto pelo ajuste normal quanto pelo estorno.
 */
async function gravarAjuste({
  tenantId, userId, conta, categoria,
  dataAjuste, saldoSistema, saldoReal, diferenca, motivo, descricao, estornoDe = null,
}) {
  // O schema exige valor > 0, então o sinal vive só no campo tipo.
  const tipo  = diferenca > 0 ? 'receita' : 'despesa';
  const valor = Math.abs(diferenca);

  return prisma.$transaction(async (tx) => {
    const lancamento = await tx.transaction.create({
      data: {
        tenantId,
        tipo,
        descricao,
        valor,
        dataLancamento:  dataAjuste,
        dataCompetencia: dataAjuste,
        bankAccountId:   conta.id,
        categoryId:      categoria.id,
        complemento:     motivo,
        status:          'realizado',
        origem:          ORIGEM_AJUSTE,
        criadoPor:       userId,
        ...contabilDaCategoria(categoria),
      },
    });

    const ajuste = await tx.balanceAdjustment.create({
      data: {
        tenantId,
        bankAccountId: conta.id,
        transactionId: lancamento.id,
        dataAjuste,
        saldoSistema,
        saldoReal,
        diferenca,
        motivo,
        estornoDe,
        criadoPor: userId,
      },
      include: includePadrao,
    });

    return { ...ajuste, transaction: lancamento };
  });
}

/**
 * Ajusta o saldo de uma conta para bater com o extrato bancário.
 *
 * @param data.bankAccountId
 * @param data.dataLancamento  nome escolhido para o periodGuard reconhecer
 * @param data.saldoReal       saldo que consta no extrato do banco
 * @param data.motivo          obrigatório
 * @param data.categoryId      obrigatória (exportação contábil)
 */
async function create(tenantId, userId, data = {}) {
  const { bankAccountId, dataLancamento, saldoReal, motivo, categoryId } = data;

  if (!bankAccountId)  throw { status: 400, message: 'Conta bancária obrigatória' };
  if (!dataLancamento) throw { status: 400, message: 'Data do ajuste obrigatória' };
  if (saldoReal === undefined || saldoReal === null || saldoReal === '') {
    throw { status: 400, message: 'Informe o saldo real do extrato bancário' };
  }

  const saldoInformado = Number(saldoReal);
  if (!Number.isFinite(saldoInformado)) {
    throw { status: 400, message: 'Saldo real inválido' };
  }

  const justificativa = String(motivo || '').trim();
  if (justificativa.length < MOTIVO_MIN) {
    throw {
      status: 400,
      message: `Explique o motivo do ajuste com pelo menos ${MOTIVO_MIN} caracteres. ` +
               'Essa justificativa fica registrada e é o que permite auditar a correção depois.',
    };
  }

  const dataAjuste = new Date(dataLancamento);
  if (isNaN(dataAjuste.getTime())) throw { status: 400, message: 'Data do ajuste inválida' };

  await exigirCompetenciaAberta(tenantId, dataLancamento);
  const categoria = await carregarCategoria(categoryId, tenantId);

  // Saldo do sistema no fim do dia do ajuste.
  const fimDoDia = new Date(dataLancamento + 'T23:59:59');
  const { conta, saldo: saldoSistema } =
    await bankAccountsSvc.saldoNaData(tenantId, bankAccountId, fimDoDia);

  const diferenca = Number((saldoInformado - saldoSistema).toFixed(2));
  if (diferenca === 0) {
    throw {
      status: 400,
      message: 'O saldo do sistema já é igual ao saldo informado. Não há o que ajustar.',
    };
  }

  return gravarAjuste({
    tenantId, userId, conta, categoria,
    dataAjuste,
    saldoSistema,
    saldoReal: saldoInformado,
    diferenca,
    motivo: justificativa,
    descricao: `Ajuste de saldo em ${fmtData(dataAjuste)}`,
  });
}

/**
 * Estorna um ajuste criando outro no sentido contrário.
 *
 * Não dá para simplesmente apagar: transactions.service.js proíbe editar ou
 * excluir lançamento já exportado para o Domínio. E mesmo que desse, apagar
 * destruiria a trilha de auditoria, que é o objetivo do recurso.
 */
async function estornar(id, tenantId, userId, data = {}) {
  const original = await findOne(id, tenantId);

  if (original.estornoDe) {
    throw { status: 400, message: 'Este lançamento já é um estorno e não pode ser estornado de novo' };
  }

  const jaEstornado = await prisma.balanceAdjustment.findFirst({
    where: { tenantId, estornoDe: id },
  });
  if (jaEstornado) throw { status: 400, message: 'Este ajuste já foi estornado' };

  const justificativa = String(data.motivo || '').trim();
  if (justificativa.length < MOTIVO_MIN) {
    throw { status: 400, message: `Explique o motivo do estorno com pelo menos ${MOTIVO_MIN} caracteres` };
  }

  // O estorno é lançado HOJE, não na data do ajuste original: a competência
  // daquele mês pode já estar fechada, e reabrir para estornar seria pior.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  await exigirCompetenciaAberta(tenantId, hoje);

  const lancamentoOriginal = original.transactionId
    ? await prisma.transaction.findFirst({ where: { id: original.transactionId, tenantId } })
    : null;

  const categoria = await carregarCategoria(
    data.categoryId || lancamentoOriginal?.categoryId,
    tenantId
  );

  const { conta, saldo: saldoSistema } =
    await bankAccountsSvc.saldoNaData(tenantId, original.bankAccountId);

  // Inverte exatamente a diferença do ajuste original.
  const diferenca = Number((-Number(original.diferenca)).toFixed(2));

  return gravarAjuste({
    tenantId, userId, conta, categoria,
    dataAjuste: hoje,
    saldoSistema,
    saldoReal: Number((saldoSistema + diferenca).toFixed(2)),
    diferenca,
    motivo: justificativa,
    descricao: `Estorno do ajuste de saldo de ${fmtData(original.dataAjuste)}`,
    estornoDe: id,
  });
}

module.exports = {
  previa,
  list,
  findOne,
  create,
  estornar,
  ORIGEM_AJUSTE,
  MOTIVO_MIN,
};
