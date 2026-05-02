const router = require('express').Router();
const ctrl = require('./users.controller');
const authMiddleware = require('../../middleware/auth');
const tenantGuard = require('../../middleware/tenantGuard');
const roleGuard = require('../../middleware/roleGuard');

router.use(authMiddleware);

// Rotas de admin total — gestão de usuários Totali
router.get('/', tenantGuard, ctrl.listar);
router.get('/:id', ctrl.buscar);
router.post('/', tenantGuard, ctrl.criar);
router.put('/:id', ctrl.atualizar);
router.patch('/senha', ctrl.trocarSenha);
router.get('/:id/vinculos', ctrl.listarVinculos);

// Vínculos — requer nível 1 na empresa (ou admin total)
router.post('/vincular', tenantGuard, roleGuard(1), ctrl.vincular);
router.delete('/vincular/:userId', tenantGuard, roleGuard(1), ctrl.desvincular);

module.exports = router;
