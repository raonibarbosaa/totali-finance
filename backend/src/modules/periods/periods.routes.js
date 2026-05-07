// periods.routes.js
const express = require('express');
const router  = express.Router();
const authenticate = require('../../middleware/auth');
const tenantGuard  = require('../../middleware/tenantGuard');
const roleGuard    = require('../../middleware/roleGuard');
const ctrl = require('./periods.controller');

router.use(authenticate, tenantGuard);

router.get('/',        roleGuard([1]), ctrl.list);
router.get('/status',  roleGuard([1]), ctrl.status);
router.post('/close',  roleGuard([1]), ctrl.close);
router.post('/reopen', roleGuard([1]), ctrl.reopen); // Apenas Admin Totali no middleware de cima

module.exports = router;
