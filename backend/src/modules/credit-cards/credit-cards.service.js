'use strict';

// ─────────────────────────────────────────────────────────────────────────
// credit-cards.service.js — Etapa 1: cadastro de cartões e leitura da fatura.
//
// O QUE ESTA ETAPA FAZ
// Cadastra cartões, recebe o PDF da fatura, lê e guarda as linhas para
// conferência. Nada é classificado e nada vira lançamento ainda.
//
// POR QUE CARTÃO NÃO É UMA CONTA BANCÁRIA
// Cartão não tem saldo, tem limite e fatura. Se entrasse como BankAccount, o
// dashboard e o ajuste de saldo somariam o cartão ao caixa da empresa. O elo
// com o banco é o bankAccountId: a conta DE ONDE a fatura é paga.
//
// O QUE VEM NA ETAPA 2
// De-para (texto -> categoria e fornecedor) e geração dos lançamentos: cada
// compra como despesa na data da compra, e o pagamento da fatura como saída do
// banco contra cartão a pagar, fora do DRE.
// ─────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const prisma = require('../../config/database');
const { escolherLeitor, listarEmissores } = require('./parsers');

// Importa a lib direto de lib/. O index.js do pacote tem um bloco de depuração
// que tenta ler um PDF de teste do disco, e estoura quando ele não existe.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Abaixo disso o PDF é imagem, não texto: fatura escaneada ou protegida.
const MIN_TEXTO = 50;

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// ─────────────────────────────────────────────────────────────────────────
// Cartões
// ─────────────────────────────────────────────────────────────────────────

async function listCards(tenantId) {
  const cards = await prisma.creditCard.findMany({
    where:   { tenantId, ativo: true },
    include: { bankAccount: { select: { id: true, nome: true } } },
    orderBy: { nome: 'asc' },
  });

  // Quantas faturas cada cartão já tem, para a tela mostrar sem N consultas.
  const contagens = await prisma.cardStatement.groupBy({
    by:    ['creditCardId'],
    where: { tenantId, creditCardId: { in: cards.map((c) => c.id) } },
    _count: { _all: true },
  });
  const porCartao = Object.fromEntries(
    contagens.map((c) => [c.creditCardId, c._count?._all || 0])
  );

  return cards.map((c) => ({ ...c, totalFaturas: porCartao[c.id] || 0 }));
}

async function findCard(id, tenantId) {
  const c = await prisma.creditCard.findFirst({
    where:   { id, tenantId },
    include: { bankAccount: { select: { id: true, nome: true } } },
  });
  if (!c) throw { status: 404, message: 'Cartão não encontrado' };
  return c;
}

function validarDia(valor, rotulo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) {
    throw { status: 400, message: `${rotulo} deve ser um dia entre 1 e 31` };
  }
  return n;
}

async function createCard(tenantId, data = {}) {
  const { nome, emissor, bandeira, ultimos4, limite, diaFechamento, diaVencimento, bankAccountId } = data;
  if (!nome || !String(nome).trim()) throw { status: 400, message: 'Nome do cartão obrigatório' };

  if (ultimos4 && !/^\d{4}$/.test(String(ultimos4))) {
    throw { status: 400, message: 'Últimos 4 dígitos devem ser exatamente 4 números' };
  }

  // Conta pagadora precisa ser da mesma empresa.
  if (bankAccountId) {
    const conta = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
    if (!conta) throw { status: 404, message: 'Conta bancária não encontrada' };
  }

  return prisma.creditCard.create({
    data: {
      tenantId,
      nome:          String(nome).trim(),
      emissor:       emissor || 'generico',
      bandeira:      bandeira || null,
      ultimos4:      ultimos4 || null,
      limite:        limite === undefined || limite === '' || limite === null ? null : parseFloat(limite),
      diaFechamento: validarDia(diaFechamento, 'Dia de fechamento'),
      diaVencimento: validarDia(diaVencimento, 'Dia de vencimento'),
      bankAccountId: bankAccountId || null,
    },
    include: { bankAccount: { select: { id: true, nome: true } } },
  });
}

async function updateCard(id, tenantId, data = {}) {
  await findCard(id, tenantId);

  if (data.ultimos4 && !/^\d{4}$/.test(String(data.ultimos4))) {
    throw { status: 400, message: 'Últimos 4 dígitos devem ser exatamente 4 números' };
  }
  if (data.bankAccountId) {
    const conta = await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId, tenantId } });
    if (!conta) throw { status: 404, message: 'Conta bancária não encontrada' };
  }

  return prisma.creditCard.update({
    where: { id },
    data: {
      ...(data.nome          !== undefined && { nome: String(data.nome).trim() }),
      ...(data.emissor       !== undefined && { emissor: data.emissor || 'generico' }),
      ...(data.bandeira      !== undefined && { bandeira: data.bandeira || null }),
      ...(data.ultimos4      !== undefined && { ultimos4: data.ultimos4 || null }),
      ...(data.limite        !== undefined && { limite: data.limite === '' || data.limite === null ? null : parseFloat(data.limite) }),
      ...(data.diaFechamento !== undefined && { diaFechamento: validarDia(data.diaFechamento, 'Dia de fechamento') }),
      ...(data.diaVencimento !== undefined && { diaVencimento: validarDia(data.diaVencimento, 'Dia de vencimento') }),
      ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId || null }),
    },
    include: { bankAccount: { select: { id: true, nome: true } } },
  });
}

/** Desativa. Não apaga, porque as faturas importadas apontam para o cartão. */
async function removeCard(id, tenantId) {
  await findCard(id, tenantId);
  await prisma.creditCard.update({ where: { id }, data: { ativo: false } });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Faturas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chave de deduplicação de uma linha.
 *
 * Data + descrição + valor não bastam: duas compras iguais no mesmo
 * estabelecimento no mesmo dia existem e são lançamentos distintos. Por isso
 * entra a ordem da linha DENTRO DAQUELE DIA — mesma estratégia das rotinas de
 * conversão de extrato, que numeram sequencialmente dentro do dia.
 */
function hashDaLinha(creditCardId, linha, ordemNoDia) {
  const dia = linha.dataCompra.toISOString().slice(0, 10);
  return sha256(`${creditCardId}|${dia}|${linha.descricao}|${linha.valor}|${ordemNoDia}`);
}

/** Numera cada linha dentro do seu dia, para o hash não colidir. */
function comOrdemNoDia(linhas) {
  const contador = {};
  return linhas.map((l) => {
    const dia = l.dataCompra.toISOString().slice(0, 10);
    contador[dia] = (contador[dia] || 0) + 1;
    return { ...l, ordemNoDia: contador[dia] };
  });
}

async function importStatement({ tenantId, userId, creditCardId, fileBuffer, fileName }) {
  if (!creditCardId) throw { status: 400, message: 'Cartão obrigatório' };
  if (!fileBuffer || !fileBuffer.length) throw { status: 400, message: 'Arquivo PDF não recebido' };

  const card = await findCard(creditCardId, tenantId);

  // Dedup de arquivo inteiro, antes de qualquer processamento.
  const hashArquivo = sha256(fileBuffer);
  const jaImportado = await prisma.cardStatement.findFirst({
    where:  { tenantId, hashArquivo },
    select: { id: true, nomeArquivo: true, importadoEm: true },
  });
  if (jaImportado) {
    // A data entra só se existir: o caminho de erro não pode quebrar por causa
    // da formatação, senão o usuário recebe uma falha genérica em vez do aviso.
    const quando = jaImportado.importadoEm
      ? ` em ${new Date(jaImportado.importadoEm).toLocaleDateString('pt-BR')}`
      : '';
    throw {
      status: 409,
      code:   'FATURA_DUPLICADA',
      message: `Esta fatura já foi importada${quando}.`,
      data:   { existingStatementId: jaImportado.id },
    };
  }

  let texto;
  try {
    const dados = await pdfParse(fileBuffer);
    texto = dados.text || '';
  } catch (e) {
    throw { status: 400, message: `Não foi possível ler o PDF: ${e.message}` };
  }

  // PDF de imagem: a extração devolve quase nada. Avisar é melhor do que dizer
  // que não achou lançamentos, que mandaria o usuário procurar no lugar errado.
  if (texto.trim().length < MIN_TEXTO) {
    throw {
      status: 422,
      code:   'PDF_SEM_TEXTO',
      message:
        'Este PDF não tem texto, provavelmente é uma imagem escaneada. ' +
        'Baixe a fatura direto do aplicativo ou do site do banco, em vez de digitalizar o papel.',
    };
  }

  const leitor = escolherLeitor(texto, card.emissor);
  const { cabecalho, linhas } = leitor.extrair(texto);

  if (!linhas.length) {
    throw {
      status: 422,
      code:   'NENHUM_LANCAMENTO',
      message:
        `O leitor "${leitor.rotulo}" não reconheceu nenhum lançamento neste PDF. ` +
        'O layout deste emissor provavelmente é diferente do esperado.',
      data: { emissor: leitor.nome },
    };
  }

  const numeradas = comOrdemNoDia(linhas);

  return prisma.$transaction(async (tx) => {
    const statement = await tx.cardStatement.create({
      data: {
        tenantId,
        creditCardId,
        nomeArquivo:         fileName || null,
        hashArquivo,
        emissorDetectado:    leitor.nome,
        // Competência = mês do vencimento, quando o PDF informa.
        competencia:         cabecalho.dataVencimento
          ? new Date(Date.UTC(
              cabecalho.dataVencimento.getUTCFullYear(),
              cabecalho.dataVencimento.getUTCMonth(), 1))
          : null,
        dataVencimento:      cabecalho.dataVencimento || null,
        valorTotalInformado: cabecalho.valorTotalInformado ?? null,
        totalLinhas:         numeradas.length,
        importadoPor:        userId,
      },
    });

    await tx.cardStatementEntry.createMany({
      data: numeradas.map((l) => ({
        tenantId,
        cardStatementId: statement.id,
        creditCardId,
        dataCompra:      l.dataCompra,
        descricao:       l.descricao.slice(0, 500),
        valor:           l.valor,
        tipo:            l.tipo,
        parcelaNumero:   l.parcelaNumero,
        parcelaTotal:    l.parcelaTotal,
        status:          'pendente',
        hashLinha:       hashDaLinha(creditCardId, l, l.ordemNoDia),
      })),
      // Linha repetida de uma importação anterior do mesmo cartão é ignorada.
      skipDuplicates: true,
    });

    const gravadas = await tx.cardStatementEntry.count({
      where: { cardStatementId: statement.id },
    });

    return {
      statementId: statement.id,
      emissor:     leitor.nome,
      rotulo:      leitor.rotulo,
      totalLidas:  numeradas.length,
      gravadas,
      repetidas:   numeradas.length - gravadas,
      ...resumoDasLinhas(numeradas, cabecalho.valorTotalInformado),
      dataVencimento:      cabecalho.dataVencimento || null,
      valorTotalInformado: cabecalho.valorTotalInformado ?? null,
    };
  });
}

/**
 * Conferência: a soma das linhas contra o total impresso na fatura.
 *
 * Pagamento e estorno entram negativos porque abatem a fatura. Se a diferença
 * não for zero, o leitor perdeu ou inventou alguma linha, e a tela precisa
 * mostrar isso antes de qualquer coisa virar lançamento.
 */
function resumoDasLinhas(linhas, totalInformado) {
  const porTipo = { compra: 0, estorno: 0, pagamento: 0, encargo: 0 };
  let soma = 0;

  for (const l of linhas) {
    porTipo[l.tipo] = (porTipo[l.tipo] || 0) + 1;
    const sinal = (l.tipo === 'pagamento' || l.tipo === 'estorno') ? -1 : 1;
    soma += sinal * l.valor;
  }

  soma = Number(soma.toFixed(2));
  const diferenca = totalInformado === null || totalInformado === undefined
    ? null
    : Number((soma - totalInformado).toFixed(2));

  return {
    porTipo,
    somaLinhas: soma,
    diferenca,
    confere: diferenca === null ? null : Math.abs(diferenca) < 0.01,
  };
}

async function listStatements(tenantId, creditCardId) {
  return prisma.cardStatement.findMany({
    where:   { tenantId, ...(creditCardId && { creditCardId }) },
    include: {
      creditCard:  { select: { id: true, nome: true } },
      importador:  { select: { id: true, nome: true } },
    },
    orderBy: [{ dataVencimento: 'desc' }, { importadoEm: 'desc' }],
  });
}

async function findStatement(id, tenantId) {
  const st = await prisma.cardStatement.findFirst({
    where:   { id, tenantId },
    include: {
      creditCard: { select: { id: true, nome: true, emissor: true, ultimos4: true } },
      importador: { select: { id: true, nome: true } },
    },
  });
  if (!st) throw { status: 404, message: 'Fatura não encontrada' };

  const entries = await prisma.cardStatementEntry.findMany({
    where:   { cardStatementId: id },
    orderBy: [{ dataCompra: 'asc' }, { criadoEm: 'asc' }],
  });

  // Recalcula a conferência a partir do que está gravado, e não do que foi lido
  // na importação: é isso que o usuário está vendo na tela.
  const paraResumo = entries.map((e) => ({ tipo: e.tipo, valor: Number(e.valor) }));
  const resumo = resumoDasLinhas(
    paraResumo,
    st.valorTotalInformado === null ? null : Number(st.valorTotalInformado)
  );

  return { ...st, entries, ...resumo };
}

/**
 * Apaga a fatura e suas linhas.
 *
 * Recusa se alguma linha já virou lançamento — apagar aqui deixaria a
 * Transaction órfã. Na Etapa 2 isso passa a acontecer, e a recusa já fica
 * pronta desde agora.
 */
async function removeStatement(id, tenantId) {
  await findStatement(id, tenantId);

  const comLancamento = await prisma.cardStatementEntry.count({
    where: { cardStatementId: id, transactionId: { not: null } },
  });
  if (comLancamento > 0) {
    throw {
      status: 400,
      message: `Esta fatura já gerou ${comLancamento} lançamento(s). Exclua os lançamentos antes.`,
    };
  }

  // As linhas caem por cascade (onDelete: Cascade no schema).
  await prisma.cardStatement.delete({ where: { id } });
  return { ok: true };
}

module.exports = {
  listCards, findCard, createCard, updateCard, removeCard,
  importStatement, listStatements, findStatement, removeStatement,
  listarEmissores,
  // Expostos para teste.
  _internos: { hashDaLinha, comOrdemNoDia, resumoDasLinhas },
};
