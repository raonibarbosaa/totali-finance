const express = require('express');
const router = express.Router();
const auth   = require('../../middleware/auth');
const tGuard = require('../../middleware/tenantGuard');
const rGuard = require('../../middleware/roleGuard');
const prisma = require('../../config/database');
const bankAccountsService = require('../bank-accounts/bank-accounts.service');

router.use(auth, tGuard);

// Status considerados como "movimentação efetivada" para fins de saldo.
const STATUS_EFETIVADOS = ['realizado', 'conciliado'];

// Tipos de conta que entram em "Saldo disponível" (exclui poupança).
const TIPOS_DISPONIVEIS = ['caixa', 'corrente'];

router.get('/stats', rGuard([1, 2, 3]), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Filtro base: efetivadas e excluindo transferências internas
    const baseFilter = {
      tenantId,
      status: { in: STATUS_EFETIVADOS },
      origem: { not: 'transferencia' },
    };

    const [
      receitas,
      despesas,
      titulos,
      contasComSaldo,
      gruposPorCategoria,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...baseFilter, tipo: 'receita', dataLancamento: { gte: firstDay, lte: lastDay } },
        _sum: { valor: true },
      }),
      prisma.transaction.aggregate({
        where: { ...baseFilter, tipo: 'despesa', dataLancamento: { gte: firstDay, lte: lastDay } },
        _sum: { valor: true },
      }),
      prisma.title.count({
        where: {
          tenantId,
          status: { in: ['aberto', 'parcial'] },
          dataVencimento: { lte: new Date(Date.now() + 7 * 86400000) },
        },
      }),
      bankAccountsService.list(tenantId),
      prisma.transaction.groupBy({
        by: ['tipo', 'categoryId'],
        where: { ...baseFilter, dataLancamento: { gte: firstDay, lte: lastDay } },
        _sum: { valor: true },
      }),
    ]);

    // Soma o saldo só das contas tipo caixa + corrente
    const saldoDisponivel = contasComSaldo
      .filter(c => TIPOS_DISPONIVEIS.includes(c.tipo))
      .reduce((s, c) => s + Number(c.saldoAtual || 0), 0);

    // Resolve nomes das categorias
    const catIds = gruposPorCategoria.filter(g => g.categoryId).map(g => g.categoryId);
    const cats = catIds.length
      ? await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, nome: true } })
      : [];
    const catNomes = Object.fromEntries(cats.map(c => [c.id, c.nome]));

    const formatGrupo = (tipo) => gruposPorCategoria
      .filter(g => g.tipo === tipo)
      .map(g => ({
        categoria: g.categoryId ? (catNomes[g.categoryId] || 'Sem categoria') : 'Sem categoria',
        total: Number(g._sum.valor || 0),
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        receitas: Number(receitas._sum.valor || 0),
        despesas: Number(despesas._sum.valor || 0),
        resultado: Number(receitas._sum.valor || 0) - Number(despesas._sum.valor || 0),
        titulosVencer: titulos,
        saldoTotal: saldoDisponivel,
        categorias: {
          receitas: formatGrupo('receita'),
          despesas: formatGrupo('despesa'),
        },
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
