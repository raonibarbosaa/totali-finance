// recurring-titles.controller.js
const svc = require('./recurring-titles.service');

const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e) => res.status(e.status || 400).json({ success: false, error: e.message || e });

exports.list     = async (req, res) => { try { ok(res, await svc.list(req.tenantId, req.query));                            } catch(e){err(res,e);} };
exports.findOne  = async (req, res) => { try { ok(res, await svc.findOne(req.params.id, req.tenantId));                     } catch(e){err(res,e);} };
exports.create   = async (req, res) => { try { ok(res, await svc.create(req.tenantId, req.user.id, req.body), 201);         } catch(e){err(res,e);} };
exports.update   = async (req, res) => { try { ok(res, await svc.update(req.params.id, req.tenantId, req.body));            } catch(e){err(res,e);} };
exports.impacto  = async (req, res) => { try { ok(res, await svc.impacto(req.params.id, req.tenantId));                     } catch(e){err(res,e);} };

// escopoExclusao vem no BODY no cancelar (POST) e na QUERY STRING no remove
// (DELETE), já que DELETE não deve carregar corpo.
exports.cancelar = async (req, res) => { try { ok(res, await svc.cancelar(req.params.id, req.tenantId, req.body?.escopoExclusao));  } catch(e){err(res,e);} };
exports.remove   = async (req, res) => { try { ok(res, await svc.remove(req.params.id, req.tenantId, req.query?.escopoExclusao));   } catch(e){err(res,e);} };

// Endpoint manual de geração — útil pra debug/admin. Em produção a geração
// acontece automaticamente em titles.service.list().
exports.gerar = async (req, res) => {
  try { ok(res, await svc.gerarOcorrenciasPendentes(req.tenantId)); }
  catch(e) { err(res, e); }
};
