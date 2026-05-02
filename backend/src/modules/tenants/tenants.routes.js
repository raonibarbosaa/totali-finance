const router = require('express').Router();
const ctrl = require('./tenants.controller');
const authMiddleware = require('../../middleware/auth');
const tenantGuard = require('../../middleware/tenantGuard');

// Todas as rotas de tenants são exclusivas para Admin Total
function adminTotalOnly(req, res, next) {
  if (req.user?.perfil !== 'admin_total') {
    return res.status(403).json({ success: false, error: 'Acesso restrito ao administrador.' });
  }
  next();
}

router.use(authMiddleware);
router.use(adminTotalOnly);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscar);
router.post('/', ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.patch('/:id/status', ctrl.alterarStatus);

module.exports = router;
