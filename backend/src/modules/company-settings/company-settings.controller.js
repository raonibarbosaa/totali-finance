const svc = require('./company-settings.service');
const ok = (res, data) => res.json({ success:true, data });
const err = (res, e) => res.status(e.status||400).json({ success:false, error:e.message||e });
exports.get    = async(req,res)=>{ try{ ok(res, await svc.get(req.tenantId)) }catch(e){err(res,e)} };
exports.update = async(req,res)=>{ try{ ok(res, await svc.update(req.tenantId, req.body)) }catch(e){err(res,e)} };
