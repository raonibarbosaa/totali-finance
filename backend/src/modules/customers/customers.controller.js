// customers.controller.js
const svc       = require('./customers.service');
const importSvc = require('./customers-import.service');

const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e) => res.status(e.status || 400).json({ success: false, error: e.message || e });

exports.list    = async (req, res) => { try { ok(res, await svc.list(req.tenantId, req.query));            } catch(e){err(res,e);} };
exports.findOne = async (req, res) => { try { ok(res, await svc.findOne(req.params.id, req.tenantId));     } catch(e){err(res,e);} };
exports.create  = async (req, res) => { try { ok(res, await svc.create(req.tenantId, req.body), 201);      } catch(e){err(res,e);} };
exports.update  = async (req, res) => { try { ok(res, await svc.update(req.params.id, req.tenantId, req.body)); } catch(e){err(res,e);} };
exports.remove  = async (req, res) => { try { ok(res, await svc.remove(req.params.id, req.tenantId));      } catch(e){err(res,e);} };

// Etapa 4A — importação em massa via planilha
exports.previewImport = async (req, res) => {
  try {
    if (!req.file) throw { status: 400, message: 'Arquivo não enviado' };
    ok(res, await importSvc.preview(req.tenantId, req.file.buffer));
  } catch (e) { err(res, e); }
};

exports.executeImport = async (req, res) => {
  try {
    if (!req.file) throw { status: 400, message: 'Arquivo não enviado' };
    ok(res, await importSvc.execute(req.tenantId, req.file.buffer));
  } catch (e) { err(res, e); }
};
