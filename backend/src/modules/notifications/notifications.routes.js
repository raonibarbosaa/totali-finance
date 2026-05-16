const express      = require('express');
const router       = express.Router();
const authenticate = require('../../middleware/auth');
const tenantGuard  = require('../../middleware/tenantGuard');
const svc          = require('./notifications.service');

const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e)    => res.status(400).json({ success: false, error: e.message });

router.use(authenticate, tenantGuard);

// GET /api/notifications?unread=true
router.get('/', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    ok(res, await svc.listNotifications(req.tenantId, { unreadOnly }));
  } catch (e) { err(res, e); }
});

// GET /api/notifications/count
router.get('/count', async (req, res) => {
  try { ok(res, { count: await svc.countUnread(req.tenantId) }); }
  catch (e) { err(res, e); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try { ok(res, await svc.markRead(req.params.id, req.tenantId)); }
  catch (e) { err(res, e); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try { ok(res, await svc.markAllRead(req.tenantId)); }
  catch (e) { err(res, e); }
});

module.exports = router;
