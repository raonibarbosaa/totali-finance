'use strict';

const svc = require('./ofx.service');

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const err = (res, e) => {
  const status = e.status || 400;
  const body = {
    success: false,
    error:   e.message || String(e),
  };
  if (e.code) body.code = e.code;
  if (e.data) body.data = e.data;
  res.status(status).json(body);
};

exports.importFile = async (req, res) => {
  try {
    if (!req.file) {
      throw { status: 400, message: 'Arquivo OFX não enviado (campo "file").' };
    }
    const { bankAccountId } = req.body;
    const result = await svc.importFile({
      tenantId:      req.tenantId,
      userId:        req.user.id,
      bankAccountId,
      fileBuffer:    req.file.buffer,
      fileName:      req.file.originalname,
    });
    ok(res, result, 201);
  } catch (e) {
    err(res, e);
  }
};

exports.listImports = async (req, res) => {
  try { ok(res, await svc.listImports(req.tenantId, req.query)); }
  catch (e) { err(res, e); }
};

exports.findImport = async (req, res) => {
  try { ok(res, await svc.findImport(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
};

exports.listEntries = async (req, res) => {
  try { ok(res, await svc.listEntries(req.params.id, req.tenantId, req.query)); }
  catch (e) { err(res, e); }
};

exports.removeImport = async (req, res) => {
  try { ok(res, await svc.removeImport(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
};

// ─── Etapa 5B (em breve) ──────────────────────────────────────────────────
const notImpl = (etapa) => (req, res) => res.status(501).json({
  success: false,
  error:   `Funcionalidade prevista para a Etapa ${etapa}.`,
  code:    'NOT_IMPLEMENTED',
});

exports.linkEntry            = notImpl('5B');
exports.unlinkEntry          = notImpl('5B');
exports.ignoreEntry          = notImpl('5B');
exports.quickCreateFromEntry = notImpl('5C');
