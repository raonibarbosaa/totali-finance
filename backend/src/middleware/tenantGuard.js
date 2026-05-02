/**
 * Garante isolamento de dados por tenant (LGPD).
 *
 * Regras:
 * - admin_total: pode receber tenantId via query param (?tenantId=xxx) para acessar qualquer empresa
 * - admin_funcionario e cliente: usam SEMPRE o tenantId do JWT (ignoram query params)
 * - Se nenhum tenantId disponível e a rota exige, retorna 403
 */
function tenantGuard(req, res, next) {
  const { perfil } = req.user;

  if (perfil === 'admin_total') {
    // Admin total pode sobrescrever o tenantId via query param
    const tenantIdParam = req.query.tenantId || req.body?.tenantId;
    if (tenantIdParam) {
      req.tenantId = tenantIdParam;
    }
    // Admin total sem tenantId = operação de nível sistema (ex: listar tenants)
    return next();
  }

  // Para admin_funcionario e cliente: tenantId vem EXCLUSIVAMENTE do JWT
  // Garantia: nunca aceitar tenantId externo
  if (!req.tenantId) {
    return res.status(403).json({
      success: false,
      error: 'Empresa não selecionada. Faça login e selecione uma empresa.',
    });
  }

  next();
}

module.exports = tenantGuard;
