// backend/src/modules/drive/drive.routes.js
const express    = require('express');
const router     = express.Router();
const auth       = require('../../middleware/auth');
const tenantGuard = require('../../middleware/tenantGuard');
const roleGuard  = require('../../middleware/roleGuard');
const ctrl       = require('./drive.controller');

// Rotas protegidas — nível 1 (admin da empresa)
router.use(auth, tenantGuard);

// Configuração do Drive da empresa
router.get('/config',          roleGuard([1]), ctrl.getConfig);
router.post('/config',         roleGuard([1]), ctrl.saveConfig);
router.delete('/config',       roleGuard([1]), ctrl.removeConfig);

// Acionar polling manual
router.post('/sync',           roleGuard([1]), ctrl.syncNow);

// Logs de importação
router.get('/logs',            roleGuard([1]), ctrl.getLogs);
router.get('/logs/:id/download', roleGuard([1]), ctrl.downloadOriginal);

// Admin Totali — criar pasta para empresa cliente
router.post('/create-folder',  roleGuard([1]), ctrl.createFolder);

module.exports = router;
