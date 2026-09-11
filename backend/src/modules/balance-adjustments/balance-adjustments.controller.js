// balance-adjustments.controller.js
const svc = require('./balance-adjustments.service');

const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e) => res.status(e.status || 400).json({
  success: false,
  error: e.message || e,
  ...(e.code && { code: e.code }),
});

exports.previa   = async (req, res) => { try { ok(res, await svc.previa(req.tenantId, req.query.bankAccountId, req.query.data));  } catch(e){err(res,e);} };
exports.list     = async (req, res) => { try { ok(res, await svc.list(req.tenantId, req.query));                                   } catch(e){err(res,e);} };
exports.findOne  = async (req, res) => { try { ok(res, await svc.findOne(req.params.id, req.tenantId));                            } catch(e){err(res,e);} };
exports.create   = async (req, res) => { try { ok(res, await svc.create(req.tenantId, req.user.id, req.body), 201);                } catch(e){err(res,e);} };
exports.estornar = async (req, res) => { try { ok(res, await svc.estornar(req.params.id, req.tenantId, req.user.id, req.body), 201); } catch(e){err(res,e);} };
