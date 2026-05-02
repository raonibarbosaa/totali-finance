/**
 * Verifica se o usuário tem o nível mínimo de acesso para a rota.
 *
 * Uso: router.use(roleGuard(1)) — exige nível Gerencial
 *      router.use(roleGuard(2)) — exige nível Operacional ou superior
 *      router.use(roleGuard(3)) — qualquer nível autenticado
 *
 * Admin Total e Admin Funcionário com nível adequado passam.
 */
function roleGuard(nivelMinimo) {
  return (req, res, next) => {
    const { perfil } = req.user;

    // Admin total sempre passa
    if (perfil === 'admin_total') return next();

    // Verifica role do usuário na empresa selecionada
    const role = req.role;
    if (!role) {
      return res.status(403).json({
        success: false,
        error: 'Você não possui acesso a esta empresa.',
      });
    }

    if (role > nivelMinimo) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Nível de permissão insuficiente.',
      });
    }

    next();
  };
}

module.exports = roleGuard;
