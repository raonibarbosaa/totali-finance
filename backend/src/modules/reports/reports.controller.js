// reports.controller.js
const svc = require('./reports.service');
const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e, s = 400) => res.status(s).json({ success: false, error: e.message || e });

exports.getDRE = async (req, res) => {
  try {
    const { year, month, regime } = req.query;
    if (!year) throw new Error('Ano obrigatório');
    const data = await svc.getDRE(req.tenantId, { year: parseInt(year), month: month ? parseInt(month) : null, regime });
    ok(res, data);
  } catch (e) { err(res, e); }
};

exports.getDFC = async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year) throw new Error('Ano obrigatório');
    const data = await svc.getDFC(req.tenantId, { year: parseInt(year), month: month ? parseInt(month) : null });
    ok(res, data);
  } catch (e) { err(res, e); }
};

exports.getMonthlyComparison = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) throw new Error('Ano obrigatório');
    const data = await svc.getMonthlyComparison(req.tenantId, { year: parseInt(year) });
    ok(res, data);
  } catch (e) { err(res, e); }
};
