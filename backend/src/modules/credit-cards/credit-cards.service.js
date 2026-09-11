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
const padroesSvc = require('../card-patterns/card-patterns.service');
const titlesSvc  = require('../titles/titles.service');

// Importa a lib direto de lib/. O index.js do pacote tem um bloco de depuração
// que tenta ler um PDF de teste do disco, e estoura quando ele não existe.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Abaixo disso o PDF é imagem, não texto: fatura escaneada ou protegida.
const MIN_TEXTO = 50;

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const includeCartao = {
  bankAccount:    { select: { id: true, nome: true } },
  categoryFatura: { select: { id: true, nome: true, contaDebito: true, contaCredito: true } },
};

// ─────────────────────────────────────────────────────────────────────────
// Cartões
// ─────────────────────────────────────────────────────────────────────────

async function listCards(tenantId) {
  const cards = await prisma.creditCard.findMany({
    where:   { tenantId, ativo: true },
    include: includeCartao,
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
    include: includeCartao,
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
  // contaCartao e categoryIdFatura sao lidos direto de `data` mais abaixo.
  if (!nome || !String(nome).trim()) throw { status: 400, message: 'Nome do cartão obrigatório' };

  if (ultimos4 && !/^\d{4}$/.test(String(ultimos4))) {
    throw { status: 400, message: 'Últimos 4 dígitos devem ser exatamente 4 números' };
  }

  // Conta pagadora precisa ser da mesma empresa.
  if (bankAccountId) {
    const conta = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, tenantId } });
    if (!conta) throw { status: 404, message: 'Conta bancária não encontrada' };
  }
  if (data.categoryIdFatura) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryIdFatura, tenantId } });
    if (!cat) throw { status: 404, message: 'Categoria da fatura não encontrada' };
  }

  return prisma.creditCard.create({
    data: {
      tenantId,
      nome:          String(nome).trim(),
      emissor:       emissor || 'auto',
      bandeira:      bandeira || null,
      ultimos4:      ultimos4 || null,
      limite:        limite === undefined || limite === '' || limite === null ? null : parseFloat(limite),
      diaFechamento: validarDia(diaFechamento, 'Dia de fechamento'),
      diaVencimento: validarDia(diaVencimento, 'Dia de vencimento'),
      bankAccountId: bankAccountId || null,
      contaCartao:      data.contaCartao ? String(data.contaCartao).trim() : null,
      categoryIdFatura: data.categoryIdFatura || null,
    },
    include: includeCartao,
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
  if (data.categoryIdFatura) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryIdFatura, tenantId } });
    if (!cat) throw { status: 404, message: 'Categoria da fatura não encontrada' };
  }

  return prisma.creditCard.update({
    where: { id },
    data: {
      ...(data.nome          !== undefined && { nome: String(data.nome).trim() }),
      ...(data.emissor       !== undefined && { emissor: data.emissor || 'auto' }),
      ...(data.bandeira      !== undefined && { bandeira: data.bandeira || null }),
      ...(data.ultimos4      !== undefined && { ultimos4: data.ultimos4 || null }),
      ...(data.limite        !== undefined && { limite: data.limite === '' || data.limite === null ? null : parseFloat(data.limite) }),
      ...(data.diaFechamento !== undefined && { diaFechamento: validarDia(data.diaFechamento, 'Dia de fechamento') }),
      ...(data.diaVencimento !== undefined && { diaVencimento: validarDia(data.diaVencimento, 'Dia de vencimento') }),
      ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId || null }),
      ...(data.contaCartao   !== undefined && { contaCartao: data.contaCartao ? String(data.contaCartao).trim() : null }),
      ...(data.categoryIdFatura !== undefined && { categoryIdFatura: data.categoryIdFatura || null }),
    },
    include: includeCartao,
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
        // Fatura empresarial agrupa as compras por pessoa; o leitor devolve
        // isso e a tela mostra o gasto de cada portador.
        portador:        l.portador ? String(l.portador).slice(0, 120) : null,
        status:          'pendente',
        hashLinha:       hashDaLinha(creditCardId, l, l.ordemNoDia),
      })),
      // Linha repetida de uma importação anterior do mesmo cartão é ignorada.
      skipDuplicates: true,
    });

    // Classificação automática pelo de-para, antes de devolver o resumo.
    await classificarLinhas(tx, tenantId, statement.id);

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

// ─────────────────────────────────────────────────────────────────────────
// Classificação
// ─────────────────────────────────────────────────────────────────────────

/**
 * Aplica o de-para nas linhas ainda sem categoria de uma fatura.
 *
 * Os padrões são carregados UMA vez e casados em memória: uma fatura tem
 * dezenas de linhas e os padrões são os mesmos para todas.
 *
 * Só mexe em linha sem categoria. Reimportar ou reclassificar não desfaz o que
 * o usuário ajustou à mão.
 */
async function classificarLinhas(tx, tenantId, cardStatementId) {
  const padroes = await padroesSvc.carregarAtivos(tenantId, tx);
  if (padroes.length === 0) return { classificadas: 0 };

  const linhas = await tx.cardStatementEntry.findMany({
    where:  { cardStatementId, categoryId: null, supplierId: null },
    select: { id: true, descricao: true },
  });

  let classificadas = 0;
  for (const l of linhas) {
    const padrao = padroesSvc.casar(l.descricao, padroes);
    if (!padrao) continue;

    await tx.cardStatementEntry.update({
      where: { id: l.id },
      data: {
        categoryId: padrao.categoryId || null,
        supplierId: padrao.supplierId || null,
        complementoAuto: padrao.complementoAuto || null,
        status: 'classificado',
      },
    });
    classificadas += 1;
  }
  return { classificadas };
}

/** Reaplica o de-para numa fatura já importada, depois de criar regras novas. */
async function reclassificar(statementId, tenantId) {
  await findStatement(statementId, tenantId);
  return prisma.$transaction((tx) => classificarLinhas(tx, tenantId, statementId));
}

/** Ajuste manual de uma linha. */
async function classificarLinha(entryId, tenantId, { categoryId, supplierId }) {
  const linha = await prisma.cardStatementEntry.findFirst({ where: { id: entryId, tenantId } });
  if (!linha) throw { status: 404, message: 'Linha não encontrada' };
  if (linha.transactionId) {
    throw {
      status: 400,
      message: 'Esta linha já virou lançamento. Desfaça a geração antes de reclassificar.',
    };
  }

  if (categoryId) {
    const c = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!c) throw { status: 404, message: 'Categoria não encontrada' };
  }
  if (supplierId) {
    const f = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!f) throw { status: 404, message: 'Fornecedor não encontrado' };
  }

  return prisma.cardStatementEntry.update({
    where: { id: entryId },
    data: {
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      status: (categoryId || supplierId) ? 'classificado' : 'pendente',
    },
  });
}

/**
 * Aplica a mesma classificação a TODAS as linhas com a mesma descrição na
 * fatura. Na fatura real da Cora, isso resolve seis linhas de APPLE de uma vez.
 */
async function classificarPorDescricao(statementId, tenantId, { descricao, categoryId, supplierId }) {
  await findStatement(statementId, tenantId);
  if (!descricao) throw { status: 400, message: 'Descrição obrigatória' };

  const r = await prisma.cardStatementEntry.updateMany({
    where: {
      tenantId, cardStatementId: statementId, descricao,
      transactionId: null,
    },
    data: {
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      status: (categoryId || supplierId) ? 'classificado' : 'pendente',
    },
  });
  return { atualizadas: r.count };
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

  // A tela precisa saber, ANTES de gerar, quantas linhas ficariam sem
  // codificação contábil: elas somem da exportação para o Domínio.
  return { ...st, entries, ...resumo, geracao: diagnosticar(entries) };
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

// ─────────────────────────────────────────────────────────────────────────
// Geração dos lançamentos
//
// COMO A DESPESA FICA
// Cada compra vira uma despesa que NÃO toca saldo de banco: o dinheiro só sai
// quando a fatura é paga. O credito vai para a conta de cartão a pagar.
//
// AS DUAS DATAS
// dataCompetencia = data da compra, dataLancamento = vencimento da fatura.
// Assim o DRE fecha nos dois regimes: por competência a despesa aparece no mês
// da compra, por caixa no mês em que a fatura é paga.
//
// PARCELA É EXCEÇÃO
// A parcela leva competência do MÊS DA FATURA, e não do mês da compra original.
// Se levasse, importar a fatura de setembro mudaria o resultado de maio, que o
// escritório já entregou ao cliente.
//
// O PAGAMENTO DA FATURA
// Vira um título a pagar, baixado como qualquer outro. Não é despesa: as
// compras já foram lançadas. O título debita cartão a pagar e credita o banco.
// ─────────────────────────────────────────────────────────────────────────

// Tipos de linha que viram despesa. Pagamento antecipado fica de fora: ele já
// saiu do banco quando aconteceu, e aqui só abate o valor do título.
const TIPOS_DESPESA = ['compra', 'encargo'];

const fmtMesAno = (d) =>
  new Date(d).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Monta a descrição do lançamento: estabelecimento, parcela e portador. */
function descricaoDoLancamento(linha) {
  const partes = [linha.descricao];
  if (linha.parcelaNumero && linha.parcelaTotal) {
    partes.push(`${linha.parcelaNumero}/${linha.parcelaTotal}`);
  }
  if (linha.portador) partes.push(`(${linha.portador})`);
  return partes.join(' ').slice(0, 255);
}

/** Quantas linhas ficariam sem codificação contábil, e por quê. */
function diagnosticar(entries) {
  const geraveis = entries.filter((e) => e.transactionId === null &&
    (TIPOS_DESPESA.includes(e.tipo) || e.tipo === 'estorno'));
  const semCategoria = geraveis.filter((e) => !e.categoryId);
  return {
    geraveis: geraveis.length,
    semCategoria: semCategoria.length,
    jaGerados: entries.filter((e) => e.transactionId !== null).length,
  };
}

/**
 * Gera os lançamentos de uma fatura e o título do pagamento.
 *
 * Tudo numa transação só: ou sai completo, ou não sai nada. Uma fatura pela
 * metade seria pior que nenhuma.
 */
async function gerarLancamentos(statementId, tenantId, userId) {
  const st = await findStatement(statementId, tenantId);
  const card = await findCard(st.creditCardId, tenantId);

  const diag = diagnosticar(st.entries);
  if (diag.jaGerados > 0) {
    throw {
      status: 400,
      code: 'JA_GERADO',
      message: `Esta fatura já gerou ${diag.jaGerados} lançamento(s). Desfaça a geração antes de gerar de novo.`,
    };
  }
  if (diag.geraveis === 0) {
    throw { status: 400, message: 'Não há linhas para gerar lançamento nesta fatura.' };
  }

  // A conta de cartão a pagar é o crédito de toda compra. Sem ela o lançamento
  // sai sem codificação e some da exportação para o Domínio.
  if (!card.contaCartao) {
    throw {
      status: 400,
      code: 'CARTAO_SEM_CONTA',
      message:
        `O cartão "${card.nome}" não tem a conta contábil de cartão a pagar configurada. ` +
        'Cadastre-a no cartão: ela é o crédito de cada compra.',
    };
  }
  if (!card.categoryIdFatura) {
    throw {
      status: 400,
      code: 'CARTAO_SEM_CATEGORIA_FATURA',
      message:
        `O cartão "${card.nome}" não tem a categoria do pagamento da fatura configurada. ` +
        'Ela é usada no título a pagar que a fatura gera.',
    };
  }

  const vencimento = st.dataVencimento || st.competencia || new Date();
  const totalFatura = st.valorTotalInformado !== null && st.valorTotalInformado !== undefined
    ? Number(st.valorTotalInformado)
    : st.somaLinhas;

  // Categorias das linhas, para herdar a codificação contábil de uma vez.
  const idsCat = [...new Set(st.entries.map((e) => e.categoryId).filter(Boolean))];
  const cats = idsCat.length
    ? await prisma.category.findMany({ where: { id: { in: idsCat }, tenantId } })
    : [];
  const porCat = Object.fromEntries(cats.map((c) => [c.id, c]));

  const resultado = await prisma.$transaction(async (tx) => {
    let criados = 0;
    let semCodificacao = 0;

    for (const linha of st.entries) {
      if (linha.transactionId) continue;
      const ehDespesa = TIPOS_DESPESA.includes(linha.tipo);
      const ehEstorno = linha.tipo === 'estorno';
      if (!ehDespesa && !ehEstorno) continue;   // pagamento não vira lançamento

      const cat = linha.categoryId ? porCat[linha.categoryId] : null;

      // Parcela fica na competência do mês da fatura; o resto, na data da compra.
      const ehParcelada = !!(linha.parcelaNumero && linha.parcelaTotal);
      const dataCompetencia = ehParcelada ? vencimento : linha.dataCompra;

      const contaDebito  = cat?.contaDebito || null;
      if (!contaDebito) semCodificacao += 1;

      const lanc = await tx.transaction.create({
        data: {
          tenantId,
          // Estorno é lançamento contrário: abate a despesa.
          tipo:            ehEstorno ? 'receita' : 'despesa',
          descricao:       descricaoDoLancamento(linha),
          valor:           Number(linha.valor),
          dataLancamento:  vencimento,
          dataCompetencia,
          // Compra de cartão não mexe em saldo de banco.
          bankAccountId:   null,
          categoryId:      linha.categoryId || null,
          supplierId:      linha.supplierId || null,
          complemento:     linha.complementoAuto || null,
          status:          'realizado',
          origem:          'cartao',
          criadoPor:       userId,
          // Débito vem da categoria; crédito é sempre cartão a pagar.
          contaDebito,
          contaCredito:    card.contaCartao,
          codHistorico:    cat?.codHistorico || null,
          centroCustoD:    cat?.centroCustoD || null,
          centroCustoC:    cat?.centroCustoC || null,
        },
      });

      await tx.cardStatementEntry.update({
        where: { id: linha.id },
        data:  { transactionId: lanc.id },
      });
      criados += 1;
    }

    return { criados, semCodificacao };
  });

  // O título fica FORA da transação acima porque titlesSvc.create abre a sua
  // própria. Se falhar, os lançamentos ficam e o desfazer limpa tudo.
  const titulo = await titlesSvc.create(tenantId, userId, {
    tipo:           'pagar',
    descricao:      `Fatura ${card.nome} — ${fmtMesAno(vencimento)}`,
    valor:          totalFatura,
    dataVencimento: new Date(vencimento).toISOString().slice(0, 10),
    dataEmissao:    new Date(vencimento).toISOString().slice(0, 10),
    categoryId:     card.categoryIdFatura,
    bankAccountId:  card.bankAccountId || null,
    observacao:     `Gerado da fatura importada em ${new Date(st.importadoEm).toLocaleDateString('pt-BR')}`,
  });

  return {
    ...resultado,
    tituloId:    titulo.id,
    valorTitulo: totalFatura,
    vencimento,
  };
}

/**
 * Desfaz a geração: apaga os lançamentos e o título.
 *
 * Recusa se algum lançamento já foi exportado para o Domínio, porque apagá-lo
 * criaria diferença entre o que foi entregue e o que ficou no sistema.
 */
async function desfazerLancamentos(statementId, tenantId) {
  const st = await findStatement(statementId, tenantId);

  const ids = st.entries.map((e) => e.transactionId).filter(Boolean);
  if (ids.length === 0) throw { status: 400, message: 'Esta fatura não gerou lançamentos.' };

  const exportados = await prisma.transaction.count({
    where: { tenantId, id: { in: ids }, exportado: true },
  });
  if (exportados > 0) {
    throw {
      status: 400,
      message:
        `${exportados} lançamento(s) desta fatura já foram exportados para o Domínio e não podem ser apagados. ` +
        'Para corrigir, faça o lançamento contrário.',
    };
  }

  // O título da fatura, encontrado pela descrição e vencimento.
  const card = await findCard(st.creditCardId, tenantId);
  const vencimento = st.dataVencimento || st.competencia;
  const titulo = vencimento ? await prisma.title.findFirst({
    where: {
      tenantId, tipo: 'pagar',
      descricao: `Fatura ${card.nome} — ${fmtMesAno(vencimento)}`,
    },
  }) : null;

  if (titulo && titulo.status !== 'aberto') {
    throw {
      status: 400,
      message: `O título desta fatura já está ${titulo.status}. Estorne a baixa antes de desfazer a geração.`,
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.cardStatementEntry.updateMany({
      where: { cardStatementId: statementId },
      data:  { transactionId: null },
    });
    const r = await tx.transaction.deleteMany({ where: { tenantId, id: { in: ids } } });
    if (titulo) await tx.title.delete({ where: { id: titulo.id } });
    return { apagados: r.count, tituloApagado: !!titulo };
  });
}

module.exports = {
  listCards, findCard, createCard, updateCard, removeCard,
  importStatement, listStatements, findStatement, removeStatement,
  reclassificar, classificarLinha, classificarPorDescricao,
  gerarLancamentos, desfazerLancamentos,
  listarEmissores,
  // Expostos para teste.
  _internos: { hashDaLinha, comOrdemNoDia, resumoDasLinhas },
};
