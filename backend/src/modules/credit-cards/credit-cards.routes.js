// credit-cards.routes.js
//
// rGuard recebe NUMERO. Passar array (como fazem rotas antigas do projeto)
// quebra a comparacao do middleware e libera qualquer nivel.
//
// Cadastro e importacao: nivel 1 (Gerencial), porque define como a despesa do
// cliente sera classificada. Leitura: nivel 3, para quem so confere.

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const tGuard  = require('../../middleware/tenantGuard');
const rGuard  = require('../../middleware/roleGuard');
const ctrl    = require('./credit-cards.controller');

// Fatura com muitas paginas passa dos 5 MB usados no OFX.
const LIMITE_MB = 15;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: LIMITE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt  = /\.pdf$/i.test(file.originalname || '');
    const okMime = /pdf|octet-stream/i.test(file.mimetype || '');
    if (okExt && okMime) return cb(null, true);
    cb(Object.assign(new Error('Envie a fatura em PDF.'), { status: 400 }));
  },
});

/** Traduz o erro do multer para o formato de resposta do projeto. */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (e) => {
    if (!e) return next();
    const limite = e.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
      success: false,
      error: limite ? `Arquivo maior que ${LIMITE_MB} MB.` : (e.message || 'Falha no upload.'),
    });
  });
}

router.use(auth, tGuard);

// Rotas mais especificas antes das com parametro.
router.get   ('/emissores',   rGuard(3), ctrl.emissores);

router.get   ('/statements',      rGuard(3), ctrl.listStatements);
router.post  ('/statements/import', rGuard(1), handleUpload, ctrl.importStatement);
router.get   ('/statements/:id',  rGuard(3), ctrl.findStatement);
router.delete('/statements/:id',  rGuard(1), ctrl.removeStatement);

router.get   ('/',      rGuard(3), ctrl.listCards);
router.get   ('/:id',   rGuard(3), ctrl.findCard);
router.post  ('/',      rGuard(1), ctrl.createCard);
router.put   ('/:id',   rGuard(1), ctrl.updateCard);
router.delete('/:id',   rGuard(1), ctrl.removeCard);

module.exports = router;
