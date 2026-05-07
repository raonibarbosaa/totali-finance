const express = require('express');
const router  = express.Router();
const authenticate = require('../../middleware/auth');
const tenantGuard  = require('../../middleware/tenantGuard');
const roleGuard    = require('../../middleware/roleGuard');
const ctrl = require('./export.controller');

router.use(authenticate, tenantGuard, roleGuard([1]));

router.get('/preview',      ctrl.preview);
router.get('/',             ctrl.list);
router.get('/:id/download', ctrl.download);
router.post('/generate',    ctrl.generate);

module.exports = router;
