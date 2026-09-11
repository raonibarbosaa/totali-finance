// credit-cards.controller.js
const svc = require('./credit-cards.service');

const ok  = (res, data, s = 200) => res.status(s).json({ success: true, data });
const err = (res, e) => res.status(e.status || 400).json({
  success: false,
  error: e.message || e,
  ...(e.code && { code: e.code }),
  ...(e.data && { data: e.data }),
});

// ── Cartoes ──────────────────────────────────────────────────────────
exports.listCards  = async (req, res) => { try { ok(res, await svc.listCards(req.tenantId));                          } catch(e){err(res,e);} };
exports.findCard   = async (req, res) => { try { ok(res, await svc.findCard(req.params.id, req.tenantId));            } catch(e){err(res,e);} };
exports.createCard = async (req, res) => { try { ok(res, await svc.createCard(req.tenantId, req.body), 201);          } catch(e){err(res,e);} };
exports.updateCard = async (req, res) => { try { ok(res, await svc.updateCard(req.params.id, req.tenantId, req.body));} catch(e){err(res,e);} };
exports.removeCard = async (req, res) => { try { ok(res, await svc.removeCard(req.params.id, req.tenantId));          } catch(e){err(res,e);} };

// Lista de emissores com leitor disponivel, para o select da tela.
exports.emissores  = async (req, res) => { try { ok(res, svc.listarEmissores());                                      } catch(e){err(res,e);} };

// ── Faturas ──────────────────────────────────────────────────────────
exports.importStatement = async (req, res) => {
  try {
    if (!req.file) throw { status: 400, message: 'Envie o PDF da fatura no campo "file".' };
    ok(res, await svc.importStatement({
      tenantId:     req.tenantId,
      userId:       req.user.id,
      creditCardId: req.body?.creditCardId,
      fileBuffer:   req.file.buffer,
      fileName:     req.file.originalname,
    }), 201);
  } catch (e) { err(res, e); }
};

exports.listStatements  = async (req, res) => { try { ok(res, await svc.listStatements(req.tenantId, req.query.creditCardId)); } catch(e){err(res,e);} };
exports.findStatement   = async (req, res) => { try { ok(res, await svc.findStatement(req.params.id, req.tenantId));           } catch(e){err(res,e);} };
exports.removeStatement = async (req, res) => { try { ok(res, await svc.removeStatement(req.params.id, req.tenantId));         } catch(e){err(res,e);} };

// ── Classificacao e lancamentos ──────────────────────────────────────
exports.reclassificar = async (req, res) => { try { ok(res, await svc.reclassificar(req.params.id, req.tenantId));                                   } catch(e){err(res,e);} };
exports.classificarEmLote = async (req, res) => { try { ok(res, await svc.classificarPorDescricao(req.params.id, req.tenantId, req.body));            } catch(e){err(res,e);} };
exports.classificarLinha  = async (req, res) => { try { ok(res, await svc.classificarLinha(req.params.entryId, req.tenantId, req.body));              } catch(e){err(res,e);} };
exports.gerar             = async (req, res) => { try { ok(res, await svc.gerarLancamentos(req.params.id, req.tenantId, req.user.id), 201);           } catch(e){err(res,e);} };
exports.desfazer          = async (req, res) => { try { ok(res, await svc.desfazerLancamentos(req.params.id, req.tenantId));                          } catch(e){err(res,e);} };
