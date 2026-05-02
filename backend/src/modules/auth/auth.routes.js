const router = require('express').Router();
const ctrl = require('./auth.controller');
const authMiddleware = require('../../middleware/auth');

// POST /api/auth/login
router.post('/login', ctrl.login);

// POST /api/auth/selecionar-empresa (requer JWT básico — sem tenantId ainda)
router.post('/selecionar-empresa', ctrl.selecionarEmpresa);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me (requer JWT completo com tenantId)
router.get('/me', authMiddleware, ctrl.me);

module.exports = router;
