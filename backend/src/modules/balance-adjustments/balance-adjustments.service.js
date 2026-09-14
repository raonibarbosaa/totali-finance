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
// O QUE O AJUSTE NÃO É
// Não é lançamento contábil. Ele não entra no DRE, no DFC, nos cartões do
// dashboard nem na exportação para o Domínio. Na contabilidade, o período
// anterior ao ajuste entra pelo extrato bancário completo, com os valores do
// banco, e não pelo que o Finance tem.
//
// Por isso o ajuste não tem conta de débito e crédito: ele não vira partida
// dobrada em lugar nenhum. Todos os filtros se ancoram em origem='ajuste', em
// reports.service.js, dashboard.routes.js e export.service.js.
//
// O AJUSTE COMO MARCO DE CORTE
// Além de acertar o saldo, o ajuste marca uma data: dali para trás o Finance
// não recebe mais movimento daquela conta. Quem usa isso é a importação de
// OFX (ofx.service.js), através de dataCorteDaConta().
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

const resumoUsuario = { select: { id: true, nome: true, email: true } };

const includePadrao = {
  bankAccount: { select: { id: true, nome: true, banco: true } },
  criador:     resumoUsuario,
  editor:      resumoUsuario,
  cancelador:  resumoUsuario,
};

/** Primeiro dia do mês da data, em UTC. É a chave da competência. */
const competenciaDe = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
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

// ─────────────────────────────────────────────────────────────────────────
// Categorias fixas do ajuste
//
// O usuário não escolhe categoria: o ajuste sempre usa a mesma, e o sistema
// decide qual pelo SENTIDO da diferença.
//
// São duas apenas para o tipo da categoria bater com o tipo do lançamento:
// entrada é receita, saída é despesa. Elas não carregam conta contábil nenhuma,
// porque o ajuste não vai para a contabilidade. Servem só de rótulo na lista
// de lançamentos do Finance.
// ─────────────────────────────────────────────────────────────────────────

const CATEGORIAS_SISTEMA = {
  entrada: {
    codigoSistema: 'ajuste_entrada',
    nome:          'Ajuste de Saldo (Entrada)',
    tipo:          'receita',
  },
  saida: {
    codigoSistema: 'ajuste_saida',
    nome:          'Ajuste de Saldo (Saída)',
    tipo:          'despesa',
  },
};

/**
 * Devolve as duas categorias do ajuste, criando as que faltarem.
 * Não pedem nem guardam conta contábil: o ajuste não é lançamento contábil.
 */
async function garantirCategorias(tenantId) {
  const encontradas = await prisma.category.findMany({
    where: {
      tenantId,
      codigoSistema: { in: Object.values(CATEGORIAS_SISTEMA).map((c) => c.codigoSistema) },
    },
  });

  const porCodigo = Object.fromEntries(encontradas.map((c) => [c.codigoSistema, c]));
  const resultado = {};

  for (const [sentido, def] of Object.entries(CATEGORIAS_SISTEMA)) {
    resultado[sentido] = porCodigo[def.codigoSistema] || await prisma.category.create({
      data: {
        tenantId,
        nome:          def.nome,
        tipo:          def.tipo,
        natureza:      'variavel',
        subtipo:       'operacional',
        codigoSistema: def.codigoSistema,
        // dfcType fica no default. Não importa muito: o ajuste é excluído do
        // DFC pela origem, antes de chegar na classificação por categoria.
      },
    });
  }

  return resultado;
}

/** Escolhe a categoria pelo sentido da diferença. Nada a configurar. */
async function categoriaDoAjuste(tenantId, diferenca) {
  const cats = await garantirCategorias(tenantId);
  return cats[diferenca > 0 ? 'entrada' : 'saida'];
}

// ─────────────────────────────────────────────────────────────────────────
// O ajuste como marco de corte
// ─────────────────────────────────────────────────────────────────────────

/**
 * Data do ajuste mais recente de uma conta, ou null se nunca houve ajuste.
 *
 * Quem consome é a importação de OFX: lançamentos anteriores a esta data são
 * desconsiderados, porque aquele período já foi acertado contra o extrato e a
 * contabilidade o recebe pelo extrato completo, não pelo Finance.
 */
async function dataCorteDaConta(tenantId, bankAccountId) {
  const ultimo = await prisma.balanceAdjustment.findFirst({
    // Ajuste cancelado não vale como marco: o lançamento dele não existe mais,
    // então aquele período nunca chegou a ser acertado contra o extrato.
    where:   { tenantId, bankAccountId, canceladoEm: null },
    orderBy: { dataAjuste: 'desc' },
    select:  { dataAjuste: true },
  });
  return ultimo ? ultimo.dataAjuste : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Consulta
// ─────────────────────────────────────────────────────────────────────────

/**
 * Prévia para a tela: quanto o sistema diz que a conta tem numa data.
 * Usa a MESMA função de saldo das telas de contas e do extrato.
 */
async function previa(tenantId, bankAccountId, data, ignorarAjusteId = null) {
  if (!bankAccountId) throw { status: 400, message: 'Conta bancária obrigatória' };
  if (!data)          throw { status: 400, message: 'Data obrigatória' };

  // Ao EDITAR um ajuste, a tela pede a prévia ignorando o lançamento dele —
  // senão o saldo já viria corrigido pelo próprio ajuste que se quer corrigir.
  let ignorarTransactionIds = [];
  if (ignorarAjusteId) {
    const alvo = await prisma.balanceAdjustment.findFirst({
      where:  { id: ignorarAjusteId, tenantId },
      select: { transactionId: true },
    });
    if (alvo?.transactionId) ignorarTransactionIds = [alvo.transactionId];
  }

  const { conta, saldo, receitas, despesas } = await bankAccountsSvc.saldoNaData(
    tenantId, bankAccountId, new Date(data + 'T23:59:59'), { ignorarTransactionIds },
  );

  // A tela mostra qual categoria será usada, para o contador conferir onde o
  // lançamento cai. Não há nada a configurar nelas.
  const cats = await garantirCategorias(tenantId);
  const resumoCat = (c) => ({ id: c.id, nome: c.nome, tipo: c.tipo });

  // Também devolve a data do último ajuste desta conta: é o marco de corte que
  // a importação de OFX vai respeitar, e a tela avisa quando já existe um.
  const corte = await dataCorteDaConta(tenantId, bankAccountId);

  return {
    ultimoAjuste: corte,
    bankAccount:  { id: conta.id, nome: conta.nome, banco: conta.banco },
    data,
    saldoSistema: saldo,
    receitas,
    despesas,
    categorias: { entrada: resumoCat(cats.entrada), saida: resumoCat(cats.saida) },
  };
}

/**
 * Diz, para cada ajuste, que botões o painel pode oferecer.
 *
 * A tela não tem como saber sozinha se a competência está fechada nem se um
 * ajuste já foi estornado, e essas duas coisas mudam completamente o que se
 * pode fazer com ele. Então quem decide é o backend, aqui, num lugar só —
 * as mesmas regras são repetidas como validação em atualizar() e cancelar(),
 * porque botão escondido não é segurança.
 *
 * Enquanto a competência está aberta, o caminho é corrigir de frente: editar
 * ou cancelar. Depois de fechada, o único caminho é o estorno, que lança com a
 * data de hoje e não toca no mês fechado.
 */
async function decorarAcoes(tenantId, ajustes) {
  if (ajustes.length === 0) return [];

  const competencias = [...new Set(
    ajustes.map((a) => competenciaDe(a.dataAjuste).toISOString()),
  )].map((iso) => new Date(iso));

  const fechadas = await prisma.periodClosing.findMany({
    where: { tenantId, competencia: { in: competencias }, status: 'fechado' },
    select: { competencia: true },
  });
  const fechada = new Set(fechadas.map((f) => competenciaDe(f.competencia).getTime()));

  // Estornos ATIVOS (os cancelados não contam) apontando para estes ajustes.
  const estornos = await prisma.balanceAdjustment.findMany({
    where:  { tenantId, canceladoEm: null, estornoDe: { in: ajustes.map((a) => a.id) } },
    select: { estornoDe: true },
  });
  const temEstorno = new Set(estornos.map((e) => e.estornoDe));

  return ajustes.map((a) => {
    const cancelado         = !!a.canceladoEm;
    const estornado         = temEstorno.has(a.id);
    const ehEstorno         = !!a.estornoDe;
    const mesFechado        = fechada.has(competenciaDe(a.dataAjuste).getTime());
    const intocavel         = cancelado || estornado;

    return {
      ...a,
      cancelado,
      estornado,
      competenciaFechada: mesFechado,
      acoes: {
        // Estorno não se edita: ele é o espelho de outro ajuste, e mexer no
        // valor dele desfaria o par.
        editar:   !intocavel && !ehEstorno && !mesFechado,
        cancelar: !intocavel && !mesFechado,
        estornar: !intocavel && !ehEstorno && mesFechado,
      },
    };
  });
}

async function list(tenantId, filters = {}) {
  const { bankAccountId } = filters;
  const ajustes = await prisma.balanceAdjustment.findMany({
    where: { tenantId, ...(bankAccountId && { bankAccountId }) },
    include: includePadrao,
    orderBy: [{ dataAjuste: 'desc' }, { criadoEm: 'desc' }],
  });
  return decorarAcoes(tenantId, ajustes);
}

async function findOne(id, tenantId) {
  const r = await prisma.balanceAdjustment.findFirst({
    where: { id, tenantId },
    include: includePadrao,
  });
  if (!r) throw { status: 404, message: 'Ajuste não encontrado' };
  const [decorado] = await decorarAcoes(tenantId, [r]);
  return decorado;
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
        // Sem conta de débito e crédito de propósito: o ajuste não é
        // lançamento contábil e não sai na exportação para o Domínio.
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
 */
async function create(tenantId, userId, data = {}) {
  const { bankAccountId, dataLancamento, saldoReal, motivo } = data;

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

  // A categoria sai do SENTIDO da diferença, não de uma escolha do usuário.
  // Por isso vem depois do cálculo.
  const categoria = await categoriaDoAjuste(tenantId, diferenca);

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
  if (original.cancelado) {
    throw { status: 400, message: 'Este ajuste foi cancelado. Não há lançamento para estornar.' };
  }
  if (original.estornado) throw { status: 400, message: 'Este ajuste já foi estornado' };

  const justificativa = String(data.motivo || '').trim();
  if (justificativa.length < MOTIVO_MIN) {
    throw { status: 400, message: `Explique o motivo do estorno com pelo menos ${MOTIVO_MIN} caracteres` };
  }

  // O estorno é lançado HOJE, não na data do ajuste original: a competência
  // daquele mês pode já estar fechada, e reabrir para estornar seria pior.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  await exigirCompetenciaAberta(tenantId, hoje);

  const { conta, saldo: saldoSistema } =
    await bankAccountsSvc.saldoNaData(tenantId, original.bankAccountId);

  // Inverte exatamente a diferença do ajuste original.
  const diferenca = Number((-Number(original.diferenca)).toFixed(2));

  // O estorno tem sentido oposto ao original, então usa a OUTRA categoria.
  const categoria = await categoriaDoAjuste(tenantId, diferenca);

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

// ─────────────────────────────────────────────────────────────────────────
// Edição
// ─────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' de uma data guardada como @db.Date. */
const isoDe = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Corrige data, saldo real e motivo de um ajuste já feito.
 *
 * O que o usuário informa continua sendo o SALDO DO EXTRATO. A diferença é
 * sempre recalculada — inclusive quando só a data muda, porque o saldo do
 * sistema naquele outro dia é outro.
 *
 * O lançamento é o mesmo: ele muda de valor, de data e, se o sentido inverter,
 * de tipo e de categoria. Não se cria um segundo lançamento, senão a conta
 * teria os dois somando no saldo.
 *
 * A versão anterior vai para revisoes, para o painel poder mostrar depois por
 * que o saldo daquele mês mudou.
 */
async function atualizar(id, tenantId, userId, data = {}) {
  const original = await findOne(id, tenantId);

  if (original.cancelado) {
    throw { status: 400, message: 'Este ajuste foi cancelado e não pode mais ser editado.' };
  }
  if (original.estornado) {
    throw {
      status: 400,
      message: 'Este ajuste já foi estornado. Para alterá-lo, cancele antes o estorno.',
    };
  }
  if (original.estornoDe) {
    throw {
      status: 400,
      message: 'Estorno não se edita: ele espelha outro ajuste. Cancele o estorno e refaça.',
    };
  }

  const novaDataISO = data.dataLancamento || isoDe(original.dataAjuste);
  const dataAjuste  = new Date(novaDataISO);
  if (isNaN(dataAjuste.getTime())) throw { status: 400, message: 'Data do ajuste inválida' };

  const saldoInformado = Number(
    data.saldoReal === undefined || data.saldoReal === null || data.saldoReal === ''
      ? original.saldoReal
      : data.saldoReal,
  );
  if (!Number.isFinite(saldoInformado)) throw { status: 400, message: 'Saldo real inválido' };

  const justificativa = String(
    data.motivo === undefined ? original.motivo : (data.motivo || ''),
  ).trim();
  if (justificativa.length < MOTIVO_MIN) {
    throw {
      status: 400,
      message: `Explique o motivo do ajuste com pelo menos ${MOTIVO_MIN} caracteres.`,
    };
  }

  // Os DOIS meses precisam estar abertos: o de onde o ajuste sai e o de onde
  // ele passa a valer. Mexer num mês fechado por tabela é o que o estorno evita.
  await exigirCompetenciaAberta(tenantId, original.dataAjuste);
  await exigirCompetenciaAberta(tenantId, novaDataISO);

  // Sem ignorar o próprio lançamento, o saldo do sistema já viria corrigido
  // pelo ajuste antigo e a diferença daria zero.
  const fimDoDia = new Date(novaDataISO + 'T23:59:59');
  const { conta, saldo: saldoSistema } = await bankAccountsSvc.saldoNaData(
    tenantId, original.bankAccountId, fimDoDia,
    { ignorarTransactionIds: [original.transactionId] },
  );

  const diferenca = Number((saldoInformado - saldoSistema).toFixed(2));
  if (diferenca === 0) {
    throw {
      status: 400,
      message: 'Sem o ajuste, o saldo do sistema nessa data já é igual ao saldo informado. ' +
               'Nesse caso o ajuste não é mais necessário: cancele-o.',
    };
  }

  const categoria = await categoriaDoAjuste(tenantId, diferenca);
  const tipo      = diferenca > 0 ? 'receita' : 'despesa';
  const editor    = await prisma.user.findUnique({
    where: { id: userId }, select: { id: true, nome: true },
  });

  // Foto do que estava valendo até agora.
  const revisao = {
    dataAjuste:   isoDe(original.dataAjuste),
    saldoSistema: Number(original.saldoSistema),
    saldoReal:    Number(original.saldoReal),
    diferenca:    Number(original.diferenca),
    motivo:       original.motivo,
    substituidoEm:   new Date().toISOString(),
    substituidoPor:  editor ? { id: editor.id, nome: editor.nome } : null,
  };
  const revisoes = [...(Array.isArray(original.revisoes) ? original.revisoes : []), revisao];

  return prisma.$transaction(async (tx) => {
    if (original.transactionId) {
      await tx.transaction.update({
        where: { id: original.transactionId },
        data: {
          tipo,
          valor:           Math.abs(diferenca),
          dataLancamento:  dataAjuste,
          dataCompetencia: dataAjuste,
          categoryId:      categoria.id,
          descricao:       `Ajuste de saldo em ${fmtData(dataAjuste)}`,
          complemento:     justificativa,
        },
      });
    }

    return tx.balanceAdjustment.update({
      where: { id },
      data: {
        dataAjuste,
        saldoSistema,
        saldoReal: saldoInformado,
        diferenca,
        motivo: justificativa,
        revisoes,
        editadoEm:  new Date(),
        editadoPor: userId,
      },
      include: includePadrao,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Cancelamento
//
// Apaga o LANÇAMENTO — o saldo volta na hora a ser o que era antes do ajuste —
// e mantém a LINHA no painel, marcada como cancelada, com quem cancelou e por
// quê. O ponto do recurso é auditar correções de saldo; apagar o registro
// inteiro apagaria justamente a auditoria.
//
// Só vale enquanto a competência está aberta. Com o mês fechado, o caminho é
// o estorno.
// ─────────────────────────────────────────────────────────────────────────

async function cancelar(id, tenantId, userId, data = {}) {
  const original = await findOne(id, tenantId);

  if (original.cancelado) throw { status: 400, message: 'Este ajuste já está cancelado' };
  if (original.estornado) {
    throw {
      status: 400,
      message: 'Este ajuste já foi estornado. Cancele antes o estorno, senão o estorno ' +
               'ficaria sozinho, mexendo no saldo sem nada para reverter.',
    };
  }

  const justificativa = String(data.motivo || '').trim();
  if (justificativa.length < MOTIVO_MIN) {
    throw {
      status: 400,
      message: `Explique o motivo do cancelamento com pelo menos ${MOTIVO_MIN} caracteres.`,
    };
  }

  await exigirCompetenciaAberta(tenantId, original.dataAjuste);

  return prisma.$transaction(async (tx) => {
    if (original.transactionId) {
      // origem no filtro para nunca apagar, por um id errado, um lançamento
      // que não seja o do próprio ajuste.
      await tx.transaction.deleteMany({
        where: { id: original.transactionId, tenantId, origem: ORIGEM_AJUSTE },
      });
    }

    return tx.balanceAdjustment.update({
      where: { id },
      data: {
        transactionId:      null,
        canceladoEm:        new Date(),
        canceladoPor:       userId,
        motivoCancelamento: justificativa,
      },
      include: includePadrao,
    });
  });
}

module.exports = {
  previa,
  list,
  findOne,
  create,
  atualizar,
  cancelar,
  estornar,
  garantirCategorias,
  dataCorteDaConta,
  ORIGEM_AJUSTE,
  MOTIVO_MIN,
  CATEGORIAS_SISTEMA,
};
