// card-patterns.routes.js
//
// De-para define como a despesa do cliente e classificada: nivel 1 para mexer,
// nivel 3 para consultar. rGuard com NUMERO, nao array.

const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const ctrl    = require('./card-patterns.controller');

router.use(auth, tGuard);

router.get   ('/',     rGuard(3), ctrl.list);
router.get   ('/:id',  rGuard(3), ctrl.findOne);
router.post  ('/',     rGuard(1), ctrl.create);
router.put   ('/:id',  rGuard(1), ctrl.update);
router.delete('/:id',  rGuard(1), ctrl.remove);

module.exports = router;
