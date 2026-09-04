const router = require('express').Router();
const ctrl = require('./users.controller');
const authMiddleware = require('../../middleware/auth');
const tenantGuard = require('../../middleware/tenantGuard');
const roleGuard = require('../../middleware/roleGuard');

router.use(authMiddleware);

// Gestão de usuários.
// As rotas por :id passam pelo tenantGuard e, no controller, por
// service.podeGerenciarUsuario — sem isso qualquer usuário logado conseguia
// alterar ou bloquear qualquer outro do sistema.
router.get('/', tenantGuard, ctrl.listar);
// Criar usuário exige nível 1: sem isso um usuário básico da empresa
// conseguia criar um login gerencial e escalar o próprio acesso.
router.post('/', tenantGuard, roleGuard(1), ctrl.criar);
router.patch('/senha', ctrl.trocarSenha);
router.get('/:id', tenantGuard, ctrl.buscar);
router.put('/:id', tenantGuard, ctrl.atualizar);
router.get('/:id/vinculos', tenantGuard, ctrl.listarVinculos);

// Vínculos — requer nível 1 na empresa (ou admin total)
router.post('/vincular', tenantGuard, roleGuard(1), ctrl.vincular);
router.delete('/vincular/:userId', tenantGuard, roleGuard(1), ctrl.desvincular);

module.exports = router;
