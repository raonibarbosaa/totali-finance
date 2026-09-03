const service = require('./users.service');

const PERFIS_TOTALI = ['admin_total', 'admin_funcionario'];

/** Quem está pedindo: usuário do token + vínculo ativo (nível e empresa) */
function solicitante(req) {
  return {
    id: req.user.id,
    perfil: req.user.perfil,
    role: req.role,
    tenantId: req.tenantId,
  };
}

async function listar(req, res) {
  try {
    const { page, limit, escopo } = req.query;

    // 'equipe' ignora a empresa selecionada e lista o time da Totali.
    // Sem isso o tenantId do JWT sempre vencia, e a tela de Usuários Totali
    // acabava mostrando os usuários da empresa ativa.
    if (escopo === 'equipe' && !PERFIS_TOTALI.includes(req.user.perfil)) {
      return res.status(403).json({ success: false, error: 'Acesso restrito à equipe Totali.' });
    }

    const result = await service.listarUsuarios({
      tenantId: req.tenantId || null,
      escopo,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function buscar(req, res) {
  try {
    await service.podeGerenciarUsuario(solicitante(req), req.params.id, { permitirProprio: true });
    const user = await service.buscarPorId(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function criar(req, res) {
  try {
    const { nome, email, senha, perfil, tenantId, role } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (senha.length < 8) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 8 caracteres.' });
    }

    // Nível 1 de empresa só pode criar usuários para sua própria empresa
    const tenantIdFinal = req.user.perfil === 'admin_total' ? tenantId : req.tenantId;
    const perfilFinal = req.user.perfil === 'admin_total' ? (perfil || 'cliente') : 'cliente';

    const user = await service.criar({
      nome,
      email,
      senha,
      perfil: perfilFinal,
      tenantId: tenantIdFinal,
      role,
      criadoPorId: req.user.id,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    // E-mail repetido: para o admin_total devolvemos quem é a pessoa, para ele
    // poder dar acesso a mais uma empresa sem sair da tela. Para os demais fica
    // só a mensagem — revelar o dono do e-mail vazaria dado entre clientes.
    if (err.status === 409 && err.usuarioExistente && req.user.perfil === 'admin_total') {
      return res.status(409).json({
        success: false,
        error: err.message,
        usuarioExistente: err.usuarioExistente,
      });
    }
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function atualizar(req, res) {
  try {
    const { nome, email, ativo } = req.body;
    await service.podeGerenciarUsuario(solicitante(req), req.params.id);
    const user = await service.atualizar(req.params.id, { nome, email, ativo });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function trocarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ success: false, error: 'Senha atual e nova senha são obrigatórias.' });
    }
    if (novaSenha.length < 8) {
      return res.status(400).json({ success: false, error: 'Nova senha deve ter no mínimo 8 caracteres.' });
    }
    // Usuário só pode trocar a própria senha (exceto admin_total)
    const targetId = req.user.perfil === 'admin_total' ? req.params.id : req.user.id;
    await service.trocarSenha(targetId, senhaAtual, novaSenha);
    res.json({ success: true, data: { message: 'Senha alterada com sucesso.' } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function vincular(req, res) {
  try {
    const { userId, role } = req.body;
    const tenantId = req.tenantId;
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'Usuário e nível de acesso são obrigatórios.' });
    }
    const vinculo = await service.vincularUsuario({
      userId,
      tenantId,
      role,
      vinculadoPor: req.user.id,
    });
    res.json({ success: true, data: vinculo });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function desvincular(req, res) {
  try {
    const { userId } = req.params;
    const tenantId = req.tenantId;
    await service.desvincularUsuario({ userId, tenantId });
    res.json({ success: true, data: { message: 'Usuário desvinculado com sucesso.' } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function listarVinculos(req, res) {
  try {
    await service.podeGerenciarUsuario(solicitante(req), req.params.id, { permitirProprio: true });
    const vinculos = await service.listarVinculos(req.params.id);
    res.json({ success: true, data: vinculos });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

module.exports = { listar, buscar, criar, atualizar, trocarSenha, vincular, desvincular, listarVinculos };
