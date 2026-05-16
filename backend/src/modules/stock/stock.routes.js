const express = require('express');
const router  = express.Router();
const authenticate = require('../../middleware/auth');
const tenantGuard  = require('../../middleware/tenantGuard');
const roleGuard    = require('../../middleware/roleGuard');
const ctrl = require('./stock.controller');

router.use(authenticate, tenantGuard, roleGuard([1]));

router.get('/',        ctrl.list);
router.get('/current', ctrl.current);
router.post('/',       ctrl.create);
router.put('/:id',     ctrl.update);
router.delete('/:id',  ctrl.remove);

module.exports = router;
