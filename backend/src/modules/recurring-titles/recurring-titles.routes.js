const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const ctrl    = require('./recurring-titles.controller');

router.use(auth, tGuard);

// Leitura: qualquer perfil autenticado
router.get('/',           rGuard([1, 2, 3]), ctrl.list);
router.get('/:id',        rGuard([1, 2, 3]), ctrl.findOne);

// Criação/edição: nível 2+ (decisão recorrente afeta planejamento financeiro)
router.post('/',          rGuard([1, 2]),    ctrl.create);
router.put('/:id',        rGuard([1, 2]),    ctrl.update);

// Ações destrutivas: apenas admin
router.post('/:id/cancelar', rGuard([1]),    ctrl.cancelar);
router.delete('/:id',        rGuard([1]),    ctrl.remove);

// Disparo manual de geração (útil pra admin testar/forçar)
router.post('/gerar', rGuard([1]), ctrl.gerar);

module.exports = router;
