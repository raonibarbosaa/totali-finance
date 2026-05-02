// stock.controller.js
const svc = require('./stock.service');
const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e, s = 400)    => res.status(s).json({ success: false, error: e.message || e });

exports.list    = async (req, res) => { try { ok(res, await svc.list(req.tenantId));                              } catch(e){err(res,e);} };
exports.current = async (req, res) => { try { ok(res, await svc.getCurrent(req.tenantId));                        } catch(e){err(res,e);} };
exports.create  = async (req, res) => { try { ok(res, await svc.create(req.tenantId, req.user.id, req.body), 201);} catch(e){err(res,e);} };
exports.remove  = async (req, res) => { try { ok(res, await svc.remove(req.params.id, req.tenantId));             } catch(e){err(res,e);} };
