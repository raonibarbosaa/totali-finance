const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const authMiddleware = require('../../middleware/auth');

// Limite específico para recuperação de senha (dispara e-mail)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Muitos pedidos de redefinição. Aguarde uma hora e tente novamente.',
  },
});

// POST /api/auth/login
router.post('/login', ctrl.login);

// POST /api/auth/selecionar-empresa (requer JWT básico — sem tenantId ainda)
router.post('/selecionar-empresa', ctrl.selecionarEmpresa);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// ── Recuperação de senha (públicas) ───────────────────
// POST /api/auth/esqueci-senha
router.post('/esqueci-senha', resetLimiter, ctrl.esqueciSenha);

// GET /api/auth/redefinir-senha/:token — valida o link
router.get('/redefinir-senha/:token', ctrl.validarTokenReset);

// POST /api/auth/redefinir-senha
router.post('/redefinir-senha', resetLimiter, ctrl.redefinirSenha);

// GET /api/auth/me (requer JWT completo com tenantId)
router.get('/me', authMiddleware, ctrl.me);

module.exports = router;
