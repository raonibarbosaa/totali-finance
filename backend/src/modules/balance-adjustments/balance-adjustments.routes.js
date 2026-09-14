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

// Editar e cancelar so valem com a competencia aberta, e o service checa as
// duas datas (a de onde o ajuste sai e a de onde ele passa a valer). O pGuard
// aqui cobre a data nova, que vem no body como dataLancamento.
//
// O cancelamento e DELETE por ser o verbo que a tela usa, mas nao apaga o
// registro: apaga o lancamento e marca a linha como cancelada. O motivo vai no
// corpo da requisicao.
router.put   ('/:id', rGuard(1), pGuard, ctrl.atualizar);
router.delete('/:id', rGuard(1),         ctrl.cancelar);

module.exports = router;
