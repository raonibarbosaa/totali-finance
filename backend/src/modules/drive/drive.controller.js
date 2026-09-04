// backend/src/modules/drive/drive.controller.js
const { PrismaClient } = require('@prisma/client');
const driveSvc  = require('./drive.service');
const { pollAllTenants } = require('./drive.poller');

const prisma = new PrismaClient();
const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e, s = 400)    => res.status(s).json({ success: false, error: e.message || e });

// GET /api/drive/config
exports.getConfig = async (req, res) => {
  try {
    const config = await prisma.driveConfig.findUnique({ where: { tenantId: req.tenantId } });
    ok(res, config);
  } catch(e) { err(res, e); }
};

// POST /api/drive/config
exports.saveConfig = async (req, res) => {
  try {
    const { folderId, folderUrl, source } = req.body;
    if (!folderId) throw new Error('folderId obrigatório');

    const config = await prisma.driveConfig.upsert({
      where:  { tenantId: req.tenantId },
      update: { folderId, folderUrl, source: source || 'totali', active: true, updatedAt: new Date() },
      create: { tenantId: req.tenantId, folderId, folderUrl, source: source || 'totali', active: true },
    });
    ok(res, config);
  } catch(e) { err(res, e); }
};

// DELETE /api/drive/config
exports.removeConfig = async (req, res) => {
  try {
    await prisma.driveConfig.update({
      where: { tenantId: req.tenantId },
      data:  { active: false },
    });
    ok(res, { ok: true });
  } catch(e) { err(res, e); }
};

// POST /api/drive/sync — polling manual
exports.syncNow = async (req, res) => {
  try {
    await pollAllTenants();
    ok(res, { ok: true, message: 'Sincronização concluída' });
  } catch(e) { err(res, e); }
};

// GET /api/drive/logs
exports.getLogs = async (req, res) => {
  try {
    const logs = await prisma.ofxImportLog.findMany({
      where:   { tenantId: req.tenantId },
      orderBy: { importedAt: 'desc' },
      take:    50,
    });
    ok(res, logs);
  } catch(e) { err(res, e); }
};

// GET /api/drive/logs/:id/download — baixar OFX original
exports.downloadOriginal = async (req, res) => {
  try {
    const log = await prisma.ofxImportLog.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!log) return err(res, new Error('Importação não encontrada.'), 404);
    if (!log.driveFileId) {
      return err(res, new Error('Este arquivo não ficou guardado no Drive — não há o que baixar.'), 404);
    }

    let content;
    try {
      content = await driveSvc.downloadFile(log.driveFileId);
    } catch (e) {
      // Falha do lado do Google (arquivo apagado, movido, permissão revogada).
      // Registrar no log do servidor: sem isso o erro sumia sem deixar rastro.
      const motivo = e?.response?.data?.error?.message || e.message;
      console.error(`[DRIVE] Falha ao baixar ${log.driveFileId} (${log.fileName}): ${motivo}`);
      return err(res, new Error(
        `O Google não entregou o arquivo: ${motivo}. Ele pode ter sido apagado ou movido da pasta.`
      ), 502);
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${log.fileName}"`);
    res.send(content);
  } catch(e) { err(res, e); }
};

// POST /api/drive/create-folder — Admin Totali cria pasta para cliente
exports.createFolder = async (req, res) => {
  try {
    const { companyName, clientEmail, rootFolderId } = req.body;
    if (!companyName) throw new Error('companyName obrigatório');

    const folder = await driveSvc.createCompanyFolder(companyName, rootFolderId);

    if (clientEmail) {
      await driveSvc.shareFolderWithEmail(folder.id, clientEmail);
    }

    ok(res, {
      folderId:   folder.id,
      folderUrl:  folder.webViewLink,
      sharedWith: clientEmail || null,
    });
  } catch(e) { err(res, e); }
};
