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

// ─── Etapa 5A ─────────────────────────────────────────────────────────────

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

// ─── Etapa 5B ─────────────────────────────────────────────────────────────

exports.linkEntry = async (req, res) => {
  try { ok(res, await svc.linkEntry(req.params.id, req.tenantId, req.body)); }
  catch (e) { err(res, e); }
};

exports.unlinkEntry = async (req, res) => {
  try { ok(res, await svc.unlinkEntry(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
};

exports.ignoreEntry = async (req, res) => {
  try { ok(res, await svc.ignoreEntry(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
};

exports.unignoreEntry = async (req, res) => {
  try { ok(res, await svc.unignoreEntry(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
};

exports.matchCandidates = async (req, res) => {
  try { ok(res, await svc.matchCandidates(req.params.id, req.tenantId, req.query)); }
  catch (e) { err(res, e); }
};

exports.quickCreateFromEntry = async (req, res) => {
  try {
    const result = await svc.quickCreateFromEntry(req.params.id, req.tenantId, req.user.id, req.body);
    ok(res, result, 201);
  } catch (e) {
    err(res, e);
  }
};
