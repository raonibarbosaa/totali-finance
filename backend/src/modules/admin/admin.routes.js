const express = require('express');
const router  = express.Router();
const { authenticate }  = require('../../middleware/auth');
const ctrl = require('./admin.controller');

// Apenas Admin Total acessa estas rotas
const adminOnly = (req, res, next) => {
  if (req.user?.profile !== 'ADMIN_TOTAL' && req.user?.profile !== 'ADMIN_FUNC') {
    return res.status(403).json({ success: false, error: 'Acesso restrito ao Admin Totali' });
  }
  next();
};

router.use(authenticate, adminOnly);
router.get('/dashboard',       ctrl.dashboard);
router.get('/clients/:id',     ctrl.detail);

module.exports = router;
