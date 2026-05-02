const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const pGuard  = require('../../middleware/periodGuard');
const ctrl    = require('./titles.controller');

router.use(auth, tGuard);

router.get('/',              rGuard([1, 2, 3]), ctrl.list);
router.get('/summary',       rGuard([1, 2, 3]), ctrl.summary);
router.get('/:id',           rGuard([1, 2, 3]), ctrl.findOne);
router.post('/',             rGuard([1, 2, 3]), pGuard, ctrl.create);
router.put('/:id',           rGuard([1, 2, 3]), pGuard, ctrl.update);
router.delete('/:id',        rGuard([1, 2, 3]), pGuard, ctrl.remove);
router.post('/:id/baixa',    rGuard([1, 2, 3]), pGuard, ctrl.baixar);
router.post('/:id/cancelar', rGuard([1]),        pGuard, ctrl.cancelar);

module.exports = router;
