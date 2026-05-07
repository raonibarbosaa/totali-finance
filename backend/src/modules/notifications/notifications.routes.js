// notifications.controller.js + routes
const express = require('express');
const router  = express.Router();
const authenticate = require('../../middleware/auth');
const svc = require('./notifications.service');

const ok  = (res, data) => res.json({ success: true, data });
const err = (res, e)    => res.status(400).json({ success: false, error: e.message });

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.profile === 'ADMIN_TOTAL' || req.user.profile === 'ADMIN_FUNC';
    ok(res, await svc.listNotifications(req.user.id, isAdmin));
  } catch(e) { err(res, e); }
});

router.patch('/:id/read', async (req, res) => {
  try { ok(res, await svc.markRead(req.params.id)); } catch(e) { err(res, e); }
});

router.patch('/read-all', async (req, res) => {
  try { ok(res, await svc.markAllRead()); } catch(e) { err(res, e); }
});

module.exports = router;
