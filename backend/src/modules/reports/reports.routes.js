const express = require('express');
const router  = express.Router();
const { authenticate }  = require('../../middleware/auth');
const { tenantGuard }   = require('../../middleware/tenantGuard');
const { roleGuard }     = require('../../middleware/roleGuard');
const ctrl = require('./reports.controller');

router.use(authenticate, tenantGuard, roleGuard([1]));

router.get('/dre',        ctrl.getDRE);
router.get('/dfc',        ctrl.getDFC);
router.get('/monthly',    ctrl.getMonthlyComparison);

module.exports = router;
