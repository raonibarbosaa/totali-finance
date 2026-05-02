// export.controller.js
const svc = require('./export.service');
const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e, s = 400)    => res.status(s).json({ success: false, error: e.message || e });

exports.preview  = async (req, res) => { try { ok(res, await svc.previewExport(req.tenantId, req.query));                           } catch(e){err(res,e);} };
exports.generate = async (req, res) => { try { ok(res, await svc.generateExport(req.tenantId, req.user.id, req.body), 201);          } catch(e){err(res,e);} };
exports.list     = async (req, res) => { try { ok(res, await svc.listExports(req.tenantId));                                         } catch(e){err(res,e);} };
exports.download = async (req, res) => {
  try {
    const log = await svc.downloadExport(req.params.id, req.tenantId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dominio_${log.id}.txt"`);
    res.send(log.file_content);
  } catch(e){ err(res,e,404); }
};
