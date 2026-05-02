const prisma = require('../config/database');

/**
 * Bloqueia lançamentos em competências fechadas.
 * Aplicado em endpoints POST/PUT/DELETE de transactions e titles.
 */
async function periodGuard(req, res, next) {
  // Apenas em operações de escrita
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const tenantId = req.tenantId;
  if (!tenantId) return next();

  // Busca a data do lançamento no body
  const dataLancamento = req.body?.dataLancamento || req.body?.dataPagamento;
  if (!dataLancamento) return next();

  try {
    const data = new Date(dataLancamento);
    // Primeiro dia do mês do lançamento
    const competencia = new Date(data.getFullYear(), data.getMonth(), 1);

    const fechamento = await prisma.periodClosing.findUnique({
      where: {
        tenantId_competencia: {
          tenantId,
          competencia,
        },
      },
    });

    if (fechamento && fechamento.status === 'fechado') {
      const mes = competencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return res.status(422).json({
        success: false,
        error: `Competência de ${mes} está fechada. Solicite a reabertura ao escritório.`,
        code: 'PERIOD_CLOSED',
      });
    }

    next();
  } catch (err) {
    console.error('[PERIOD_GUARD]', err);
    next();
  }
}

module.exports = periodGuard;
