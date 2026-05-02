// titles.controller.js
const svc = require('./titles.service');
const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e) => res.status(e.status || 400).json({ success: false, error: e.message || e });

exports.list    = async (req, res) => { try { ok(res, await svc.list(req.tenantId, req.query));                                } catch(e){err(res,e);} };
exports.summary = async (req, res) => { try { ok(res, await svc.summary(req.tenantId));                                        } catch(e){err(res,e);} };
exports.findOne = async (req, res) => { try { ok(res, await svc.findOne(req.params.id, req.tenantId));                         } catch(e){err(res,e);} };
exports.create  = async (req, res) => { try { ok(res, await svc.create(req.tenantId, req.user.id, req.body), 201);             } catch(e){err(res,e);} };
exports.update  = async (req, res) => { try { ok(res, await svc.update(req.params.id, req.tenantId, req.body));                } catch(e){err(res,e);} };
exports.remove  = async (req, res) => { try { ok(res, await svc.remove(req.params.id, req.tenantId));                         } catch(e){err(res,e);} };
exports.baixar  = async (req, res) => { try { ok(res, await svc.baixar(req.params.id, req.tenantId, req.user.id, req.body));   } catch(e){err(res,e);} };
exports.cancelar= async (req, res) => { try { ok(res, await svc.cancelar(req.params.id, req.tenantId));                       } catch(e){err(res,e);} };
