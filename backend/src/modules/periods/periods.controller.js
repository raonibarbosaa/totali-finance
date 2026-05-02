// periods.controller.js
const svc = require('./periods.service');
const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e, s = 400)    => res.status(s).json({ success: false, error: e.message || e });

exports.list   = async (req, res) => { try { ok(res, await svc.listPeriods(req.tenantId));                                } catch(e){err(res,e);} };
exports.status = async (req, res) => { try { ok(res, await svc.getStatus(req.tenantId, req.query.year, req.query.month)); } catch(e){err(res,e);} };
exports.close  = async (req, res) => { try { ok(res, await svc.closePeriod(req.tenantId, req.user.id, req.body));         } catch(e){err(res,e);} };
exports.reopen = async (req, res) => { try { ok(res, await svc.reopenPeriod(req.tenantId, req.user.id, req.body));        } catch(e){err(res,e);} };
