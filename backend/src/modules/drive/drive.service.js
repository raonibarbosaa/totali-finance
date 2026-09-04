// backend/src/modules/drive/drive.service.js
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const prisma = new PrismaClient();

const KEY_FILE = path.resolve(__dirname, '../../../config/google-drive-key.json');
const SCOPES   = ['https://www.googleapis.com/auth/drive'];

/**
 * A integração depende de duas coisas fora do código: a chave da conta de
 * serviço no disco e a variável de ambiente ligada. Sem uma delas nada
 * funciona — e antes isso falhava em silêncio, com a tela dizendo "Conectada".
 */
function statusIntegracao() {
  const chavePresente = fs.existsSync(KEY_FILE);
  const habilitada = process.env.GOOGLE_DRIVE_ENABLED === 'true';

  let motivo = null;
  if (!chavePresente && !habilitada) {
    motivo = 'Falta a chave da conta de serviço e a variável GOOGLE_DRIVE_ENABLED.';
  } else if (!chavePresente) {
    motivo = 'Chave da conta de serviço do Google não encontrada no servidor.';
  } else if (!habilitada) {
    motivo = 'Importação automática desligada (GOOGLE_DRIVE_ENABLED não está como "true").';
  }

  return {
    pronta: chavePresente && habilitada,
    chavePresente,
    habilitada,
    caminhoChave: KEY_FILE,
    motivo,
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
function getAuth() {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(
      `Chave de acesso ao Google Drive não encontrada em ${KEY_FILE}. ` +
      'Coloque o google-drive-key.json da conta de serviço nessa pasta e reinicie o backend.'
    );
  }
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
  statusIntegracao,
  listNewOFXFiles,
  downloadFile,
  moveToProcessed,
  createCompanyFolder,
  shareFolderWithEmail,
  saveImportLog,
};
