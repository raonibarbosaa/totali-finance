// notifications.service.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cria notificação (uso interno)
async function create({ tenantId, tipo, titulo, mensagem, destinatarioId = null }) {
  return prisma.notification.create({
    data: { tenantId, tipo, titulo, mensagem, destinatarioId, lida: false },
  });
}

// Lista notificações da empresa ativa (mais recentes primeiro)
async function listNotifications(tenantId, { unreadOnly = false, limit = 30 } = {}) {
  return prisma.notification.findMany({
    where:   { tenantId, ...(unreadOnly ? { lida: false } : {}) },
    orderBy: { criadoEm: 'desc' },
    take:    limit,
  });
}

// Conta apenas não lidas (pra badge do sininho)
async function countUnread(tenantId) {
  return prisma.notification.count({ where: { tenantId, lida: false } });
}

async function markRead(id, tenantId) {
  return prisma.notification.updateMany({
    where: { id, tenantId },
    data:  { lida: true },
  });
}

async function markAllRead(tenantId) {
  return prisma.notification.updateMany({
    where: { tenantId, lida: false },
    data:  { lida: true },
  });
}

module.exports = { create, listNotifications, countUnread, markRead, markAllRead };
