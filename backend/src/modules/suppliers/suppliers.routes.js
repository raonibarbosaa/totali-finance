const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const ctrl    = require('./suppliers.controller');

router.use(auth, tGuard);

router.get('/',       rGuard([1, 2, 3]), ctrl.list);
router.get('/:id',    rGuard([1, 2, 3]), ctrl.findOne);
router.post('/',      rGuard([1, 2, 3]), ctrl.create);
router.put('/:id',    rGuard([1, 2, 3]), ctrl.update);
router.delete('/:id', rGuard([1, 2, 3]), ctrl.remove);

module.exports = router;
