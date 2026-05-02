const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');

async function listarUsuarios({ tenantId, perfil, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;

  // Admin total vê todos os usuários Totali
  if (!tenantId) {
    const where = perfil
      ? { perfil: { in: ['admin_total', 'admin_funcionario'] } }
      : { perfil: { in: ['admin_total', 'admin_funcionario'] } };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        select: {
          id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true,
          tenantRoles: { include: { tenant: { select: { id: true, razaoSocial: true } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  // Usuários de uma empresa específica
  const vinculos = await prisma.userTenantRole.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, nome: true, email: true, perfil: true, ativo: true } },
    },
    skip,
    take: limit,
  });

  return {
    users: vinculos.map(v => ({ ...v.user, role: v.role, vinculoId: v.id })),
    total: vinculos.length,
    page,
    limit,
  };
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
  const emailExists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (emailExists) throw { status: 409, message: 'E-mail já cadastrado.' };

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

  return prisma.user.update({
    where: { id },
    data: { nome, email: email?.toLowerCase().trim(), ativo },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true },
  });
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
  buscarPorId,
  criar,
  atualizar,
  trocarSenha,
  vincularUsuario,
  desvincularUsuario,
  listarVinculos,
};
