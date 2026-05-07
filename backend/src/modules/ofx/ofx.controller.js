// Stub temporário — Etapa 5 (OFX) pendente de implementação.
// Quando a etapa 5 for desenvolvida, este arquivo deve ser substituído
// pela implementação real (importação OFX, reconciliação automática,
// categorização manual de pendências, etc.).

const notImplemented = (res) => res.status(501).json({
  success: false,
  error: 'Funcionalidade OFX ainda não implementada (Etapa 5 pendente).',
  code: 'NOT_IMPLEMENTED',
});

async function listImports(req, res) {
  return notImplemented(res);
}

async function listPending(req, res) {
  return notImplemented(res);
}

async function importFile(req, res) {
  return notImplemented(res);
}

async function launchPending(req, res) {
  return notImplemented(res);
}

module.exports = { listImports, listPending, importFile, launchPending };
