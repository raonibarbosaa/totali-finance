// backend/src/modules/drive/drive.poller.js
const { PrismaClient } = require('@prisma/client');
const driveSvc  = require('./drive.service');
const ofxSvc    = require('../ofx/ofx.service');
const { parseOfx } = require('../ofx/ofx-parser');

const prisma = new PrismaClient();

async function pollAllTenants() {
  console.log('[DrivePoller] Iniciando verificação...', new Date().toISOString());

  const configs = await prisma.driveConfig.findMany({
    where: { active: true },
    include: { tenant: true },
  });

  for (const cfg of configs) {
    try {
      await pollTenant(cfg);
    } catch (e) {
      console.error(`[DrivePoller] Erro no tenant ${cfg.tenantId}:`, e.message);
    }
  }

  console.log('[DrivePoller] Verificação concluída.');
}

async function pollTenant(cfg) {
  const { tenantId, folderId, lastCheckedAt } = cfg;
  const files = await driveSvc.listNewOFXFiles(folderId, lastCheckedAt);

  if (files.length === 0) {
    await prisma.driveConfig.update({
      where: { id: cfg.id },
      data:  { lastCheckedAt: new Date() },
    });
    return;
  }

  console.log(`[DrivePoller] Tenant ${tenantId}: ${files.length} arquivo(s) encontrado(s)`);

  for (const file of files) {
    await processOFXFile(tenantId, cfg, file);
  }

  await prisma.driveConfig.update({
    where: { id: cfg.id },
    data:  { lastCheckedAt: new Date() },
  });
}

async function processOFXFile(tenantId, cfg, file) {
  try {
    console.log(`[DrivePoller] Processando: ${file.name}`);

    // 1) Baixa o conteúdo como Buffer
    const content    = await driveSvc.downloadFile(file.id);
    const fileBuffer = Buffer.from(content, 'utf-8');

    // 2) Parse para extrair ACCTID
    const parsed    = parseOfx(fileBuffer);
    const accountId = parsed.account?.accountId;
    if (!accountId) throw new Error('OFX sem ACCTID identificável');

    // 3) Busca a conta bancária correspondente
    const acctNumeric = String(accountId).replace(/\D/g, '');
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { tenantId, ativo: true, conta: { contains: acctNumeric } },
    });
    if (!bankAccount) {
      throw new Error(`Conta bancária ACCTID=${accountId} não cadastrada no sistema`);
    }

    // 4) Busca um usuário admin do tenant
    const adminUser = await prisma.userTenantRole.findFirst({
      where: { tenantId, role: { lte: 2 } },
    });
    const userId = adminUser?.userId || null;

    // 5) Tenta importar (modo padrão — com check de hash)
    let result;
    let alreadyImported = false;
    try {
      result = await ofxSvc.importFile({
        tenantId,
        userId,
        bankAccountId: bankAccount.id,
        fileBuffer,
        fileName: file.name,
      });
    } catch (e) {
      // Arquivo idêntico já importado antes (mesmo conteúdo byte-a-byte)
      if (e?.code === 'DUPLICATE_FILE' || /Unique constraint/i.test(e?.message || '')) {
        alreadyImported = true;
        result = { totalRegistros: 0, novasEntries: 0 };
      } else {
        throw e;
      }
    }

    const total      = result.totalRegistros || 0;
    const importadas = result.novasEntries  ?? result.novas ?? result.imported ?? total;
    const ignoradas  = total - importadas;

    // 6) Log
    await driveSvc.saveImportLog({
      tenantId,
      driveFileId:      file.id,
      fileName:         file.name,
      status:           alreadyImported ? 'already_imported' : 'success',
      transactionCount: importadas,
    });

    // 7) Move para "✅ Processados"
    await driveSvc.moveToProcessed(file.id, cfg.folderId);

    // 8) Notificação
    let msg;
    if (alreadyImported) {
      msg = `Arquivo "${file.name}" já havia sido importado anteriormente — sem novidades.`;
    } else if (ignoradas > 0) {
      msg = `${importadas} novas transações importadas (${ignoradas} já existiam) de "${file.name}" na conta ${bankAccount.nome}.`;
    } else {
      msg = `${importadas} transações importadas de "${file.name}" na conta ${bankAccount.nome}.`;
    }

    await prisma.notification.create({
      data: {
        tenantId,
        tipo:     alreadyImported ? 'ofx_duplicate' : 'ofx_imported',
        titulo:   alreadyImported ? 'OFX já importado' : 'OFX importado automaticamente',
        mensagem: msg,
        lida:     false,
      },
    }).catch(() => {});

    if (alreadyImported) {
      console.log(`[DrivePoller] ⏭️  ${file.name}: já importado anteriormente, arquivado`);
    } else {
      console.log(`[DrivePoller] ✅ ${file.name}: ${importadas} novas, ${ignoradas} já existiam (${bankAccount.nome})`);
    }

  } catch (e) {
    const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
    console.error(`[DrivePoller] ❌ Erro em ${file.name}:`, msg);

    await driveSvc.saveImportLog({
      tenantId,
      driveFileId: file.id,
      fileName:    file.name,
      status:      'error',
      errorMsg:    msg,
    });
  }
}

function startPoller(intervalMinutes = 15) {
  console.log(`[DrivePoller] Iniciado — intervalo: ${intervalMinutes} min`);
  pollAllTenants();
  setInterval(pollAllTenants, intervalMinutes * 60 * 1000);
}

module.exports = { startPoller, pollAllTenants };
