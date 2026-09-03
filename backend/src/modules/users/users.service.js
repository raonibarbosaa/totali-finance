const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');

const SELECT_USUARIO = {
  id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true,
  tenantRoles: {
    include: { tenant: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
  },
};

/**
 * escopo 'equipe'  → usuários da Totali, independente da empresa selecionada
 * escopo padrão    → usuários vinculados a uma empresa
 */
async function listarUsuarios({ tenantId, escopo, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;

  if (escopo === 'equipe') {
    const where = { perfil: { in: ['admin_total', 'admin_funcionario'] } };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        select: SELECT_USUARIO,
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  if (!tenantId) {
    throw { status: 400, message: 'Empresa não informada.' };
  }

  const [vinculos, total] = await Promise.all([
    prisma.userTenantRole.findMany({
      where: { tenantId },
      include: { user: { select: SELECT_USUARIO } },
      skip,
      take: limit,
    }),
    prisma.userTenantRole.count({ where: { tenantId } }),
  ]);

  return {
    users: vinculos.map(v => ({ ...v.user, role: v.role, vinculoId: v.id })),
    total,
    page,
    limit,
  };
}

/**
 * Quem pode mexer no cadastro de quem.
 * - admin_total: qualquer usuário
 * - gerente (role 1): só usuários 'cliente' vinculados à própria empresa
 * `permitirProprio` libera o próprio usuário — vale para leitura, nunca para
 * bloqueio (ninguém deve conseguir se trancar para fora).
 */
async function podeGerenciarUsuario(solicitante, alvoId, { permitirProprio = false } = {}) {
  if (solicitante.id === alvoId && !permitirProprio) {
    throw { status: 403, message: 'Você não pode alterar o seu próprio acesso.' };
  }

  const alvo = await prisma.user.findUnique({
    where: { id: alvoId },
    select: { id: true, nome: true, perfil: true, ativo: true },
  });
  if (!alvo) throw { status: 404, message: 'Usuário não encontrado.' };

  if (solicitante.perfil === 'admin_total') return alvo;

  if (solicitante.id === alvoId) return alvo;

  if (solicitante.role === 1 && solicitante.tenantId) {
    if (alvo.perfil !== 'cliente') {
      throw { status: 403, message: 'Você não tem permissão sobre este usuário.' };
    }
    const vinculo = await prisma.userTenantRole.findUnique({
      where: { userId_tenantId: { userId: alvoId, tenantId: solicitante.tenantId } },
    });
    if (!vinculo) {
      throw { status: 403, message: 'Este usuário não pertence à sua empresa.' };
    }
    return alvo;
  }

  throw { status: 403, message: 'Você não tem permissão para esta ação.' };
}

async function buscarPorId(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true,
      tenantRoles: {
        include: { tenant: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
      },
    },
  });
  if (!user) throw { status: 404, message: 'Usuário não encontrado.' };
  return user;
}

async function criar({ nome, email, senha, perfil, tenantId, role, criadoPorId }) {
  const emailExists = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: SELECT_USUARIO,
  });
  if (emailExists) {
    // Leva junto quem é a pessoa: o controller decide se pode revelar isso a
    // quem pediu (só admin_total vê — para os demais seria vazamento entre clientes).
    throw {
      status: 409,
      message: 'E-mail já cadastrado.',
      usuarioExistente: emailExists,
    };
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  const user = await prisma.user.create({
    data: {
      nome,
      email: email.toLowerCase().trim(),
      senhaHash,
      perfil: perfil || 'cliente',
    },
  });

  // Se informado tenantId e role, já cria o vínculo
  if (tenantId && role) {
    await prisma.userTenantRole.create({
      data: { userId: user.id, tenantId, role: parseInt(role), vinculadoPor: criadoPorId },
    });
  }

  const { senhaHash: _, ...userSemSenha } = user;
  return userSemSenha;
}

async function atualizar(id, { nome, email, ativo }) {
  await buscarPorId(id);

  if (email) {
    const emailExists = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), id: { not: id } },
    });
    if (emailExists) throw { status: 409, message: 'E-mail já em uso por outro usuário.' };
  }

  const atualizado = await prisma.user.update({
    where: { id },
    data: { nome, email: email?.toLowerCase().trim(), ativo },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true },
  });

  // Bloqueou: apaga os refresh tokens para ele não conseguir voltar.
  // O access token que ele ainda tem em mãos morre na próxima requisição,
  // porque o middleware de autenticação confere `ativo` no banco.
  if (ativo === false) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
  }

  return atualizado;
}

async function trocarSenha(id, senhaAtual, novaSenha) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: 'Usuário não encontrado.' };

  const senhaCorreta = await bcrypt.compare(senhaAtual, user.senhaHash);
  if (!senhaCorreta) throw { status: 401, message: 'Senha atual incorreta.' };

  const novaSenhaHash = await bcrypt.hash(novaSenha, 12);
  await prisma.user.update({ where: { id }, data: { senhaHash: novaSenhaHash } });
}

// ── Vínculos usuário × empresa ───────────────────────

async function vincularUsuario({ userId, tenantId, role, vinculadoPor }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { status: 404, message: 'Usuário não encontrado.' };

  return prisma.userTenantRole.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { role: parseInt(role), vinculadoPor },
    create: { userId, tenantId, role: parseInt(role), vinculadoPor },
  });
}

async function desvincularUsuario({ userId, tenantId }) {
  const vinculo = await prisma.userTenantRole.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!vinculo) throw { status: 404, message: 'Vínculo não encontrado.' };

  await prisma.userTenantRole.delete({
    where: { userId_tenantId: { userId, tenantId } },
  });
}

async function listarVinculos(userId) {
  return prisma.userTenantRole.findMany({
    where: { userId },
    include: { tenant: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } } },
  });
}

module.exports = {
  listarUsuarios,
  podeGerenciarUsuario,
  buscarPorId,
  criar,
  atualizar,
  trocarSenha,
  vincularUsuario,
  desvincularUsuario,
  listarVinculos,
};
