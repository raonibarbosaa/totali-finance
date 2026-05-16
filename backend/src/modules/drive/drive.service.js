// backend/src/modules/drive/drive.service.js
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const prisma = new PrismaClient();

const KEY_FILE = path.resolve(__dirname, '../../../config/google-drive-key.json');
const SCOPES   = ['https://www.googleapis.com/auth/drive'];

// ─── Auth ────────────────────────────────────────────────────────────────────
function getAuth() {
  return new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

// ─── Listar arquivos OFX novos em uma pasta ───────────────────────────────────
async function listNewOFXFiles(folderId, since) {
  const drive = getDrive();
  const sinceISO = since ? since.toISOString() : '2000-01-01T00:00:00Z';

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and name contains '.ofx' and createdTime > '${sinceISO}' and trashed = false`,
    fields: 'files(id, name, createdTime, size)',
    orderBy: 'createdTime asc',
  });

  return res.data.files || [];
}

// ─── Baixar conteúdo de um arquivo ───────────────────────────────────────────
async function downloadFile(fileId) {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data).toString('utf-8');
}

// ─── Mover arquivo para subpasta "Processados" ────────────────────────────────
async function moveToProcessed(fileId, parentFolderId) {
  const drive = getDrive();

  // Busca ou cria subpasta "✅ Processados"
  let processedFolder = null;
  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '✅ Processados' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });

  if (existing.data.files.length > 0) {
    processedFolder = existing.data.files[0].id;
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: '✅ Processados',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });
    processedFolder = created.data.id;
  }

  // Move o arquivo
  const file = await drive.files.get({ fileId, fields: 'parents' });
  const prevParents = file.data.parents.join(',');

  await drive.files.update({
    fileId,
    addParents: processedFolder,
    removeParents: prevParents,
    fields: 'id, parents',
  });
}

// ─── Criar pasta para empresa no Drive ───────────────────────────────────────
async function createCompanyFolder(companyName, rootFolderId) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: companyName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: rootFolderId ? [rootFolderId] : [],
    },
    fields: 'id, webViewLink',
  });
  return res.data;
}

// ─── Compartilhar pasta com e-mail do cliente ─────────────────────────────────
async function shareFolderWithEmail(folderId, email) {
  const drive = getDrive();
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: 'user',
      role: 'writer',
      emailAddress: email,
    },
    sendNotificationEmail: true,
  });
}

// ─── Salvar arquivo OFX localmente (log) ─────────────────────────────────────
async function saveImportLog({ tenantId, driveFileId, fileName, status, transactionCount, errorMsg }) {
  return prisma.ofxImportLog.create({
    data: {
      tenantId,
      driveFileId,
      fileName,
      status,
      transactionCount: transactionCount || 0,
      errorMsg: errorMsg || null,
      importedAt: new Date(),
    },
  });
}

module.exports = {
  listNewOFXFiles,
  downloadFile,
  moveToProcessed,
  createCompanyFolder,
  shareFolderWithEmail,
  saveImportLog,
};
