'use strict';

const express = require('express');
const multer  = require('multer');

const auth   = require('../../middleware/auth');
const tGuard = require('../../middleware/tenantGuard');
const rGuard = require('../../middleware/roleGuard');
const ctrl   = require('./ofx.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt  = /\.ofx$/i.test(file.originalname);
    const okMime = /ofx|sgml|xml|octet-stream|text\/plain/i.test(file.mimetype || '');
    if (okExt || okMime) return cb(null, true);
    cb(Object.assign(new Error('Arquivo deve ser .OFX'), { status: 400 }));
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    return res.status(err.status || 400).json({
      success: false,
      error:   err.code === 'LIMIT_FILE_SIZE'
                ? 'Arquivo OFX excede 5 MB.'
                : err.message || 'Falha no upload.',
    });
  });
};

router.use(auth, tGuard);

// ── Imports (Etapa 5A) ────────────────────────────────────────────────────
router.get   ('/imports',                 rGuard([1, 2]),                ctrl.listImports);
router.get   ('/imports/:id',             rGuard([1, 2]),                ctrl.findImport);
router.get   ('/imports/:id/entries',     rGuard([1, 2]),                ctrl.listEntries);
router.post  ('/import',                  rGuard([1, 2]), handleUpload,  ctrl.importFile);
router.delete('/imports/:id',             rGuard([1]),                   ctrl.removeImport);

// ── Ações sobre entries (Etapa 5B) ────────────────────────────────────────
router.get   ('/entries/:id/match-candidates', rGuard([1, 2]), ctrl.matchCandidates);
router.post  ('/entries/:id/link',             rGuard([1, 2]), ctrl.linkEntry);
router.post  ('/entries/:id/unlink',           rGuard([1, 2]), ctrl.unlinkEntry);
router.post  ('/entries/:id/ignore',           rGuard([1, 2]), ctrl.ignoreEntry);
router.post  ('/entries/:id/unignore',         rGuard([1, 2]), ctrl.unignoreEntry);
router.post  ('/entries/:id/quick-create',     rGuard([1, 2]), ctrl.quickCreateFromEntry);

module.exports = router;
