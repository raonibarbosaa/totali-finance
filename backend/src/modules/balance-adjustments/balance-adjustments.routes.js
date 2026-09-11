// balance-adjustments.routes.js
//
// Ajustar saldo e decisao contabil, nao tarefa de digitacao: restrito ao
// nivel 1 (Gerencial). A leitura do historico fica aberta aos demais niveis,
// porque enxergar o ajuste e justamente o ponto da auditoria.
//
// rGuard recebe NUMERO. Passar array (como fazem rotas antigas do projeto)
// quebra a comparacao do middleware e libera qualquer nivel.

const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const pGuard  = require('../../middleware/periodGuard');
const ctrl    = require('./balance-adjustments.controller');

router.use(auth, tGuard);

// Rota mais especifica antes de /:id, para o Express nao confundir.
router.get ('/previa',        rGuard(1),         ctrl.previa);
router.get ('/',              rGuard(3),         ctrl.list);
router.get ('/:id',           rGuard(3),         ctrl.findOne);
router.post('/',              rGuard(1), pGuard, ctrl.create);
router.post('/:id/estornar',  rGuard(1),         ctrl.estornar);

module.exports = router;
