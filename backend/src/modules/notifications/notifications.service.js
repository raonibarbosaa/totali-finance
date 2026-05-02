// notifications.service.js
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendNotification({ type, title, message, tenant_id, target_role }) {
  // Salva no banco
  await prisma.notification.create({
    data: { type, title, message, tenant_id, target_role, read: false },
  });

  // Envia e-mail para admins Totali se configurado
  if (process.env.SMTP_HOST && process.env.ADMIN_NOTIFY_EMAIL) {
    try {
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || process.env.SMTP_USER,
        to:      process.env.ADMIN_NOTIFY_EMAIL,
        subject: `[TotaliFinance] ${title}`,
        text:    message,
        html:    `<p>${message}</p><hr><p style="color:#888;font-size:12px">TotaliFinance — notificação automática</p>`,
      });
    } catch (e) {
      console.error('Erro ao enviar e-mail de notificação:', e.message);
    }
  }
}

async function listNotifications(userId, isAdmin) {
  return prisma.notification.findMany({
    where: isAdmin
      ? { read: false }
      : { target_role: 'CLIENT', read: false },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
}

async function markRead(id) {
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

async function markAllRead() {
  return prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
}

module.exports = { sendNotification, listNotifications, markRead, markAllRead };
