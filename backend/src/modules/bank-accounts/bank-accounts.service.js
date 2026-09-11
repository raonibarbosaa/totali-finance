const prisma = require('../../config/database');

// Status considerados como "movimentação efetivada" para fins de saldo.
// Mesma regra usada em getBalance(id) e, agora, no extrato.
const STATUS_EFETIVADOS = ['realizado', 'conciliado'];

// ─────────────────────────────────────────────────────────────────────────
// DEFINIÇÃO ÚNICA DE SALDO
//
// Existiam três cálculos independentes que discordavam entre si: as telas de
// contas e o dashboard contavam 'realizado' e 'conciliado' mas ignoravam a
// dataSaldoInicial; o extrato contava só 'realizado' mas respeitava a data.
// Na prática, um lançamento conciliado aparecia no card de saldo e sumia do
// extrato, e os dois números não batiam.
//
// Regra única, valendo em todo lugar:
//   saldo = saldoInicial + Σ receitas − Σ despesas
//   contando status efetivados, a partir da dataSaldoInicial (quando houver)
//   e até a data limite (quando informada).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Monta o filtro de data dos lançamentos que entram no saldo de uma conta.
 * Devolve undefined quando não há corte algum, para não poluir o where.
 */
function filtroDataSaldo(dataSaldoInicial, dataLimite) {
  const range = {
    ...(dataSaldoInicial && { gte: new Date(dataSaldoInicial) }),
    ...(dataLimite       && { lte: new Date(dataLimite) }),
  };
  return Object.keys(range).length > 0 ? range : undefined;
}

/**
 * Saldo de UMA conta em uma data. Sem dataLimite, é o saldo atual.
 *
 * @param {string} bankAccountId
 * @param {Date|string|null} dataLimite  inclui lançamentos até esta data
 * @returns {Promise<{ saldo, saldoInicial, receitas, despesas, conta }>}
 */
async function saldoNaData(tenantId, bankAccountId, dataLimite = null) {
  const conta = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId },
  });
  if (!conta) throw { status: 404, message: 'Conta não encontrada' };

  const dataFiltro = filtroDataSaldo(conta.dataSaldoInicial, dataLimite);

  const grupos = await prisma.transaction.groupBy({
    by: ['tipo'],
    where: {
      tenantId,
      bankAccountId,
      tipo:   { in: ['receita', 'despesa'] },
      status: { in: STATUS_EFETIVADOS },
      ...(dataFiltro && { dataLancamento: dataFiltro }),
    },
    _sum: { valor: true },
  });

  let receitas = 0;
  let despesas = 0;
  for (const g of grupos) {
    if (g.tipo === 'receita') receitas = Number(g._sum.valor || 0);
    if (g.tipo === 'despesa') despesas = Number(g._sum.valor || 0);
  }

  const saldoInicial = Number(conta.saldoInicial);
  return {
    conta,
    saldoInicial,
    receitas,
    despesas,
    saldo: Number((saldoInicial + receitas - despesas).toFixed(2)),
  };
}

/**
 * Calcula o saldoAtual para uma lista de contas bancárias.
 *
 * Faz uma única query groupBy no banco (em vez de N queries — uma por conta),
 * agregando receitas e despesas por bankAccountId. Em seguida, para cada conta
 * da lista, soma:
 *
 *   saldoAtual = saldoInicial + receitas - despesas
 *
 * Retorna a mesma lista de contas, com o campo `saldoAtual` adicionado em cada item.
 */
async function withSaldoAtual(tenantId, accounts) {
  if (!accounts || accounts.length === 0) return accounts;

  const ids = accounts.map((a) => a.id);

  // Uma única query: agrega valor por bankAccountId + tipo.
  //
  // A dataSaldoInicial varia por conta, então ela não cabe num where único.
  // Resolvemos com um OR: cada conta que tem data entra com a sua, e as demais
  // entram sem corte. Continua sendo UMA consulta para N contas.
  const comData = accounts.filter((a) => a.dataSaldoInicial);
  const semData = accounts.filter((a) => !a.dataSaldoInicial);

  const condicoesPorConta = [
    ...comData.map((a) => ({
      bankAccountId:  a.id,
      dataLancamento: { gte: new Date(a.dataSaldoInicial) },
    })),
    ...(semData.length > 0 ? [{ bankAccountId: { in: semData.map((a) => a.id) } }] : []),
  ];

  const grupos = await prisma.transaction.groupBy({
    by: ['bankAccountId', 'tipo'],
    where: {
      tenantId,
      bankAccountId: { in: ids },
      tipo: { in: ['receita', 'despesa'] },
      status: { in: STATUS_EFETIVADOS },
      ...(condicoesPorConta.length > 0 && { OR: condicoesPorConta }),
    },
    _sum: { valor: true },
  });

  // Indexa por bankAccountId para lookup O(1) por conta
  const porConta = {};
  for (const g of grupos) {
    if (!g.bankAccountId) continue;
    if (!porConta[g.bankAccountId]) porConta[g.bankAccountId] = { receita: 0, despesa: 0 };
    porConta[g.bankAccountId][g.tipo] = Number(g._sum.valor || 0);
  }

  // Quantos lançamentos cada conta tem, sem filtro de status nem de data.
  // A tela usa isso para travar o campo Saldo Inicial e explicar o porquê,
  // em vez de só mostrar o erro depois que o usuário tenta salvar.
  const contagens = await prisma.transaction.groupBy({
    by: ['bankAccountId'],
    where: { tenantId, bankAccountId: { in: ids } },
    _count: { _all: true },
  });
  const totalPorConta = Object.fromEntries(
    contagens.filter((c) => c.bankAccountId).map((c) => [c.bankAccountId, c._count?._all || 0])
  );

  return accounts.map((a) => {
    const totais = porConta[a.id] || { receita: 0, despesa: 0 };
    const saldoAtual = Number(a.saldoInicial) + totais.receita - totais.despesa;
    return {
      ...a,
      saldoAtual: Number(saldoAtual.toFixed(2)),
      temLancamentos: (totalPorConta[a.id] || 0) > 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// CONTA REPETIDA
//
// Nada impedia cadastrar a mesma conta duas vezes: bastava digitar o nome com
// outra caixa ("BANCO DO BRASIL" e "Banco do Brasil") e o sistema aceitava dois
// cadastros da mesma agência/conta. O saldo total passava a somar o mesmo
// dinheiro duas vezes, o extrato ficava partido entre os dois cadastros e a
// importação de OFX podia cair na conta errada.
//
// A identidade de uma conta bancária é o par agência + conta, dentro do banco.
// Quando esses campos não são informados (caixa, por exemplo), sobra o nome.
// ─────────────────────────────────────────────────────────────────────────

/** Texto comparável: sem acento, sem espaço sobrando, minúsculo. */
function chaveTexto(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Número comparável: só dígitos, sem zeros à esquerda ("02780" = "2780"). */
function chaveNumero(v) {
  return String(v || '').replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Procura uma conta ATIVA do tenant que seja, na prática, a mesma conta.
 * Devolve { conta, motivo } ou null.
 */
async function acharRepetida(tenantId, dados, ignorarId = null) {
  const nome    = chaveTexto(dados.nome);
  const banco   = chaveTexto(dados.banco);
  const agencia = chaveNumero(dados.agencia);
  const conta   = chaveNumero(dados.conta);

  const existentes = await prisma.bankAccount.findMany({
    where: { tenantId, ativo: true, ...(ignorarId && { NOT: { id: ignorarId } }) },
  });

  for (const c of existentes) {
    // Mesma agência + conta é a mesma conta bancária, não importa o nome.
    // Bancos diferentes podem repetir esses números, então o banco também
    // pesa — mas só quando os dois cadastros dizem qual é.
    if (agencia && conta &&
        chaveNumero(c.agencia) === agencia &&
        chaveNumero(c.conta)   === conta) {
      const bancoExistente = chaveTexto(c.banco);
      if (!banco || !bancoExistente || banco === bancoExistente) {
        return { conta: c, motivo: 'agencia_conta' };
      }
    }
    // Dois cadastros com o mesmo nome ninguém consegue diferenciar na tela.
    if (nome && chaveTexto(c.nome) === nome) return { conta: c, motivo: 'nome' };
  }
  return null;
}

function erroRepetida({ conta, motivo }) {
  const dados = [
    conta.banco,
    conta.agencia && `ag. ${conta.agencia}`,
    conta.conta   && `c/c ${conta.conta}`,
  ].filter(Boolean).join(' · ');

  return {
    status: 409,
    message: motivo === 'agencia_conta'
      ? `Esta conta bancária já está cadastrada como "${conta.nome}"` +
        `${dados ? ` (${dados})` : ''}. Use a conta existente ou confira a agência e o número da conta.`
      : `Já existe uma conta chamada "${conta.nome}". Escolha outro nome para diferenciar as duas.`,
  };
}

async function list(tenantId) {
  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId, ativo: true },
    orderBy: { nome: 'asc' },
  });
  return withSaldoAtual(tenantId, accounts);
}

async function findOne(id, tenantId) {
  const r = await prisma.bankAccount.findFirst({ where: { id, tenantId } });
  if (!r) throw { status: 404, message: 'Conta não encontrada' };
  const [comSaldo] = await withSaldoAtual(tenantId, [r]);
  return comSaldo;
}

async function create(tenantId, data) {
  const { nome, banco, agencia, conta, tipo, saldoInicial, dataSaldoInicial } = data;
  if (!nome) throw { status: 400, message: 'Nome obrigatório' };
  if (!tipo) throw { status: 400, message: 'Tipo obrigatório' };

  const repetida = await acharRepetida(tenantId, { nome, banco, agencia, conta });
  if (repetida) throw erroRepetida(repetida);

  return prisma.bankAccount.create({
    data: {
      tenantId,
      nome,
      banco: banco || null,
      agencia: agencia || null,
      conta: conta || null,
      tipo,
      saldoInicial: parseFloat(saldoInicial || 0),
      dataSaldoInicial: dataSaldoInicial ? new Date(dataSaldoInicial) : null,
    },
  });
}

async function update(id, tenantId, data) {
  const atual = await findOne(id, tenantId);

  // O saldo inicial é a âncora de TODO o extrato. Mudá-lo numa conta que já
  // tem movimento reescreve o saldo de todos os períodos, inclusive os já
  // conferidos, e não deixa rastro de quem mudou nem por quê.
  //
  // Para isso existe o ajuste de saldo, que vira lançamento e fica auditado.
  // Conta recém-cadastrada, ainda sem lançamento, segue livre para correção.
  const mudouSaldoInicial =
    data.saldoInicial !== undefined &&
    parseFloat(data.saldoInicial || 0) !== Number(atual.saldoInicial);

  const mudouDataSaldo =
    data.dataSaldoInicial !== undefined &&
    String(data.dataSaldoInicial || '') !==
      (atual.dataSaldoInicial ? atual.dataSaldoInicial.toISOString().slice(0, 10) : '');

  if (mudouSaldoInicial || mudouDataSaldo) {
    const movimentos = await prisma.transaction.count({
      where: { tenantId, bankAccountId: id },
    });
    if (movimentos > 0) {
      throw {
        status: 400,
        message:
          'Esta conta já tem lançamentos, então o saldo inicial não pode mais ser alterado. ' +
          'Use "Ajustar saldo" para corrigir o saldo: a correção vira um lançamento e fica registrada.',
      };
    }
  }

  // A mesma trava do cadastro vale aqui: editar não pode transformar esta
  // conta na cópia de outra que já existe.
  const repetida = await acharRepetida(
    tenantId,
    {
      nome:    data.nome    !== undefined ? data.nome    : atual.nome,
      banco:   data.banco   !== undefined ? data.banco   : atual.banco,
      agencia: data.agencia !== undefined ? data.agencia : atual.agencia,
      conta:   data.conta   !== undefined ? data.conta   : atual.conta,
    },
    id
  );
  if (repetida) throw erroRepetida(repetida);

  const sanitized = {
    ...data,
    ...(data.saldoInicial !== undefined && { saldoInicial: parseFloat(data.saldoInicial || 0) }),
    ...(data.dataSaldoInicial !== undefined && { dataSaldoInicial: data.dataSaldoInicial ? new Date(data.dataSaldoInicial) : null }),
  };
  return prisma.bankAccount.update({ where: { id }, data: sanitized });
}

async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.bankAccount.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

async function getBalance(id, tenantId, dataLimite = null) {
  const { conta, saldo, receitas, despesas } = await saldoNaData(tenantId, id, dataLimite);
  return { ...conta, saldoAtual: saldo, receitas, despesas, dataLimite: dataLimite || null };
}

module.exports = {
  list, findOne, create, update, remove, getBalance,
  // Expostos para o módulo de ajuste de saldo e para o extrato, que precisam
  // da MESMA definição de saldo usada aqui.
  saldoNaData, filtroDataSaldo, STATUS_EFETIVADOS,
  // Usados também pela importação/cadastro em lote, que precisa da mesma regra.
  acharRepetida, chaveTexto, chaveNumero,
};
