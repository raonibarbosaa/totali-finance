// admin.controller.js
const svc = require('./admin.service');
const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e)    => res.status(400).json({ success: false, error: e.message });

exports.dashboard = async (req, res) => { try { ok(res, await svc.getDashboardData());               } catch(e){err(res,e);} };
exports.detail    = async (req, res) => { try { ok(res, await svc.getClientDetail(req.params.id));   } catch(e){err(res,e);} };
exports.ofxPending= async (req, res) => { try { ok(res, await svc.getOfxPending(req.params.id));     } catch(e){err(res,e);} };
