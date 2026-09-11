// backend/src/modules/titles/titles.routes.js
// Etapa 4.1 (parcelamento) + 4.2 (cadastros)
//
// Substitui a versão atual + working tree mods. Inclui:
//   - rota POST /:id/estornar (local mod)
//   - rota DELETE /grupo/:grupoId (Etapa 4.1) — declarada ANTES de DELETE /:id
//
// Nota sobre ordem: Express não confunde /grupo/:grupoId com /:id porque
// têm shapes diferentes (2 segmentos vs 1). Mesmo assim, declaramos a
// rota mais específica primeiro, seguindo a convenção do projeto.

const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const pGuard  = require('../../middleware/periodGuard');
const ctrl    = require('./titles.controller');

router.use(auth, tGuard);

router.get   ('/',                rGuard([1, 2, 3]),         ctrl.list);
router.get   ('/summary',         rGuard([1, 2, 3]),         ctrl.summary);
router.get   ('/:id',             rGuard([1, 2, 3]),         ctrl.findOne);
router.post  ('/',                rGuard([1, 2, 3]), pGuard, ctrl.create);
router.put   ('/:id',             rGuard([1, 2, 3]), pGuard, ctrl.update);
router.delete('/grupo/:grupoId',  rGuard([1, 2, 3]), pGuard, ctrl.removeGrupo);
// Ações em lote. POST (e não DELETE) porque corpo em DELETE é mal suportado
// por proxies — e o projeto roda atrás de nginx. Declaradas antes de /:id.
// rGuard recebe NÚMERO: nível 2 = Operacional ou superior. As rotas acima
// passam array por engano, o que anula a checagem (ver nota no plano).
router.post  ('/lote/excluir',    rGuard(2),         pGuard, ctrl.removeLote);
router.post  ('/lote/cancelar',   rGuard(2),         pGuard, ctrl.cancelarLote);
router.delete('/:id',             rGuard([1, 2, 3]), pGuard, ctrl.remove);
router.post  ('/:id/baixa',       rGuard([1, 2, 3]), pGuard, ctrl.baixar);
router.post  ('/:id/cancelar',    rGuard([1]),       pGuard, ctrl.cancelar);
router.post  ('/:id/estornar',    rGuard([1]),       pGuard, ctrl.estornar);

module.exports = router;
