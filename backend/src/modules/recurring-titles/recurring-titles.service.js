// ─────────────────────────────────────────────────────────────────────────
// recurring-titles.service.js
//
// Gerencia templates de títulos recorrentes (Contas a Pagar/Receber Fixas).
//
// Conceitos:
//   - RecurringTitle = template (descreve uma cobrança que se repete).
//   - Title          = ocorrência concreta (uma "instância" do template).
//
// Estratégia de geração: LAZY. Quando o frontend chama GET /titles, a função
// gerarOcorrenciasPendentes() é executada antes do findMany. Ela cria, no
// banco, todos os títulos que faltam dentro da janela de 6 meses pra frente.
//
// Idempotência: garantida pela constraint @@unique([recurringTitleId,
// dataVencimento]) em titles. Se a mesma ocorrência for tentada 2x (race
// condition), a segunda falha silenciosamente.
// ─────────────────────────────────────────────────────────────────────────

const prisma = require('../../config/database');

const FREQUENCIAS = ['semanal', 'quinzenal', 'mensal', 'anual'];
const TIPOS       = ['pagar', 'receber'];

// Janela de geração: até quantos meses no futuro vamos pré-gerar títulos.
const JANELA_MESES = 6;

// ─────────────────────────────────────────────────────────────────────────
// Helpers de data
// ─────────────────────────────────────────────────────────────────────────

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Se o dia "estourou" (ex: 31/jan + 1 mês vira 03/mar), volta pro último
  // dia do mês alvo. Isso garante que "dia 31" em meses sem 31 caia no dia 30/28.
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0);
  }
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Devolve a próxima data >= base que cai no diaSemana especificado (0-6, dom-sáb).
function nextWeekday(base, diaSemana) {
  const d = startOfDay(base);
  const diff = (diaSemana - d.getDay() + 7) % 7;
  return addDays(d, diff);
}

// Para frequência mensal/anual, calcula a data de vencimento ajustada para
// o dia desejado dentro do mês alvo. Se o dia não existe (ex: 31/fev),
// usa o último dia do mês.
function vencimentoMensal(ano, mes, diaDesejado) {
  // Cria data no dia 1 do mês alvo
  const d = new Date(ano, mes, 1);
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  d.setDate(Math.min(diaDesejado, ultimoDiaDoMes));
  return startOfDay(d);
}

// ─────────────────────────────────────────────────────────────────────────
// Geração de datas a partir de um template
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calcula todas as datas de vencimento de um template entre dataDe e dataAte.
 * Retorna array de Date (já em startOfDay).
 */
function calcularDatasOcorrencias(template, dataDe, dataAte) {
  const datas = [];
  const inicio = startOfDay(template.dataInicio);
  const dataDeEfetiva = inicio > dataDe ? inicio : dataDe;
  const fim = template.dataFimGeracao
    ? (startOfDay(template.dataFimGeracao) < dataAte ? startOfDay(template.dataFimGeracao) : dataAte)
    : dataAte;

  if (dataDeEfetiva > fim) return datas;

  switch (template.frequencia) {
    case 'mensal': {
      // Itera mês a mês a partir do mês de inicio até fim
      let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
      const limite = new Date(fim.getFullYear(), fim.getMonth() + 1, 1);
      while (cursor < limite) {
        const venc = vencimentoMensal(cursor.getFullYear(), cursor.getMonth(), template.diaVencimento);
        if (venc >= dataDeEfetiva && venc <= fim) datas.push(venc);
        cursor = addMonths(cursor, 1);
      }
      break;
    }

    case 'anual': {
      // Mantém o mês de dataInicio, varia só o ano
      const mesBase = inicio.getMonth();
      let ano = inicio.getFullYear();
      while (true) {
        const venc = vencimentoMensal(ano, mesBase, template.diaVencimento);
        if (venc > fim) break;
        if (venc >= dataDeEfetiva) datas.push(venc);
        ano += 1;
      }
      break;
    }

    case 'semanal': {
      // Toda semana, no diaSemana especificado
      let cursor = nextWeekday(inicio, template.diaVencimento);
      while (cursor <= fim) {
        if (cursor >= dataDeEfetiva) datas.push(new Date(cursor));
        cursor = addDays(cursor, 7);
      }
      break;
    }

    case 'quinzenal': {
      // A cada 14 dias, partindo do primeiro diaSemana >= inicio
      let cursor = nextWeekday(inicio, template.diaVencimento);
      while (cursor <= fim) {
        if (cursor >= dataDeEfetiva) datas.push(new Date(cursor));
        cursor = addDays(cursor, 14);
      }
      break;
    }
  }

  return datas;
}

// ─────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────

async function list(tenantId, filters = {}) {
  const { tipo, ativo } = filters;
  const where = {
    tenantId,
    ...(tipo  && { tipo }),
    ...(ativo !== undefined && ativo !== '' ? { ativo: ativo === 'true' || ativo === true } : {}),
  };

  const data = await prisma.recurringTitle.findMany({
    where,
    include: { category: { select: { id: true, nome: true } } },
    orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }],
  });
  return { data };
}

async function findOne(id, tenantId) {
  const r = await prisma.recurringTitle.findFirst({
    where: { id, tenantId },
    include: { category: true },
  });
  if (!r) throw { status: 404, message: 'Recorrência não encontrada' };
  return r;
}

async function create(tenantId, userId, data) {
  const {
    tipo, descricao, valor, frequencia, diaVencimento, dataInicio,
    categoryId, numeroDocumento, nomeContato, observacao,
  } = data;

  if (!tipo || !TIPOS.includes(tipo))         throw { status: 400, message: 'Tipo inválido (use pagar ou receber)' };
  if (!descricao)                             throw { status: 400, message: 'Descrição obrigatória' };
  if (!valor || valor <= 0)                   throw { status: 400, message: 'Valor inválido' };
  if (!frequencia || !FREQUENCIAS.includes(frequencia)) throw { status: 400, message: 'Frequência inválida' };
  if (diaVencimento === undefined || diaVencimento === null) throw { status: 400, message: 'Dia de vencimento obrigatório' };
  if (!dataInicio)                            throw { status: 400, message: 'Data de início obrigatória' };

  // Valida faixa de diaVencimento conforme frequência
  const dia = parseInt(diaVencimento);
  if (frequencia === 'mensal' || frequencia === 'anual') {
    if (dia < 1 || dia > 31) throw { status: 400, message: 'Para mensal/anual, dia deve estar entre 1 e 31' };
  } else {
    // semanal/quinzenal: 0 (dom) a 6 (sáb)
    if (dia < 0 || dia > 6)  throw { status: 400, message: 'Para semanal/quinzenal, dia da semana deve estar entre 0 (dom) e 6 (sáb)' };
  }

  return prisma.recurringTitle.create({
    data: {
      tenantId,
      tipo,
      descricao,
      valor,
      frequencia,
      diaVencimento:   dia,
      dataInicio:      new Date(dataInicio),
      categoryId:      categoryId      || null,
      numeroDocumento: numeroDocumento || null,
      nomeContato:     nomeContato     || null,
      observacao:      observacao      || null,
      ativo:           true,
      criadoPor:       userId,
    },
    include: { category: true },
  });
}

async function update(id, tenantId, data) {
  const r = await findOne(id, tenantId);
  if (!r.ativo) throw { status: 400, message: 'Recorrência cancelada não pode ser editada' };

  const { descricao, valor, categoryId, numeroDocumento, nomeContato, observacao } = data;

  // Apenas campos "seguros" são editáveis. Não permitimos mudar tipo,
  // frequência, diaVencimento ou dataInicio porque isso bagunçaria as
  // ocorrências já geradas (e a lógica de qual dia vencer).
  return prisma.recurringTitle.update({
    where: { id },
    data: {
      ...(descricao       !== undefined && { descricao }),
      ...(valor           !== undefined && { valor }),
      ...(categoryId      !== undefined && { categoryId }),
      ...(numeroDocumento !== undefined && { numeroDocumento }),
      ...(nomeContato     !== undefined && { nomeContato }),
      ...(observacao      !== undefined && { observacao }),
    },
    include: { category: true },
  });
}

/**
 * Cancela uma recorrência: para de gerar novas ocorrências mas mantém os
 * títulos já gerados (mesmo os ainda em aberto).
 */
async function cancelar(id, tenantId) {
  const r = await findOne(id, tenantId);
  if (!r.ativo) throw { status: 400, message: 'Recorrência já cancelada' };

  return prisma.recurringTitle.update({
    where: { id },
    data: {
      ativo:          false,
      dataFimGeracao: startOfDay(new Date()),
    },
    include: { category: true },
  });
}

/**
 * Apaga o template definitivamente. Os títulos já gerados ficam (vão pra
 * recurring_title_id = NULL automaticamente, por causa do ON DELETE SET NULL).
 */
async function remove(id, tenantId) {
  await findOne(id, tenantId);
  await prisma.recurringTitle.delete({ where: { id } });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// gerarOcorrenciasPendentes(tenantId)
//
// Núcleo da estratégia lazy. Para cada template ativo do tenant:
//   1. Calcula as datas de ocorrência entre 1 mês atrás e 6 meses pra frente.
//   2. Tenta criar um Title pra cada data.
//   3. A constraint @@unique impede duplicatas — se já existe, o create falha
//      e é silenciosamente ignorado (tratamento individual por ocorrência).
//
// Retorna { criados: N }. Não usa transação porque queremos que falhas
// individuais não derrubem o lote inteiro.
// ─────────────────────────────────────────────────────────────────────────
async function gerarOcorrenciasPendentes(tenantId) {
  const hoje = startOfDay(new Date());
  const dataDe = addMonths(hoje, -1);
  const dataAte = addMonths(hoje, JANELA_MESES);

  const ativos = await prisma.recurringTitle.findMany({
    where: { tenantId, ativo: true },
  });

  let criados = 0;

  for (const tpl of ativos) {
    const datas = calcularDatasOcorrencias(tpl, dataDe, dataAte);

    for (const venc of datas) {
      try {
        await prisma.title.create({
          data: {
            tenantId,
            recurringTitleId: tpl.id,
            tipo:             tpl.tipo,
            descricao:        tpl.descricao,
            valor:            tpl.valor,
            dataEmissao:      venc,
            dataVencimento:   venc,
            status:           'aberto',
            categoryId:       tpl.categoryId,
            numeroDocumento:  tpl.numeroDocumento,
            nomeContato:      tpl.nomeContato,
            observacao:       tpl.observacao,
            criadoPor:        tpl.criadoPor,
          },
        });
        criados += 1;
      } catch (e) {
        // P2002 = Unique constraint failed → ocorrência já existe, OK silenciar.
        // Outros erros (FK quebrada, conexão, etc) também não devem derrubar
        // o batch inteiro: logamos e seguimos.
        if (e.code !== 'P2002') {
          console.error(
            `[gerarOcorrenciasPendentes] tenant=${tenantId} tpl=${tpl.id} venc=${venc.toISOString()}:`,
            e.message
          );
        }
      }
    }
  }

  return { criados };
}

module.exports = {
  list,
  findOne,
  create,
  update,
  cancelar,
  remove,
  gerarOcorrenciasPendentes,
};
