const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const upload  = require('../../middleware/upload');
const ctrl    = require('./customers.controller');

router.use(auth, tGuard);

// CRUD
router.get('/',       rGuard([1, 2, 3]), ctrl.list);
router.get('/:id',    rGuard([1, 2, 3]), ctrl.findOne);
router.post('/',      rGuard([1, 2, 3]), ctrl.create);
router.put('/:id',    rGuard([1, 2, 3]), ctrl.update);
router.delete('/:id', rGuard([1, 2, 3]), ctrl.remove);

// Etapa 4A — importação em massa via planilha
// Roles 1 (gestor) e 2 (operacional) podem importar; role 3 (consulta) não.
router.post('/import/preview', rGuard([1, 2]), upload.single('file'), ctrl.previewImport);
router.post('/import',         rGuard([1, 2]), upload.single('file'), ctrl.executeImport);

module.exports = router;
