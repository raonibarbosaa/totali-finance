const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  refreshTokenExpiry,
} = require('../../config/jwt');

/**
 * Login: valida credenciais e retorna lista de empresas vinculadas
 */
async function login(email, senha) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user || !user.ativo) {
    throw { status: 401, message: 'E-mail ou senha inválidos.' };
  }

  const senhaCorreta = await bcrypt.compare(senha, user.senhaHash);
  if (!senhaCorreta) {
    throw { status: 401, message: 'E-mail ou senha inválidos.' };
  }

  // Busca empresas vinculadas
  let empresas = [];
  if (user.perfil === 'admin_total') {
    // Admin total vê todas as empresas
    const tenants = await prisma.tenant.findMany({
      where: { ativo: true },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      orderBy: { razaoSocial: 'asc' },
    });
    empresas = tenants.map(t => ({ ...t, role: null, acesso: 'total' }));
  } else {
    // Busca vínculos do usuário
    const vinculos = await prisma.userTenantRole.findMany({
      where: { userId: user.id },
      include: {
        tenant: {
          select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, ativo: true },
        },
      },
    });
    empresas = vinculos
      .filter(v => v.tenant.ativo)
      .map(v => ({
        id: v.tenant.id,
        razaoSocial: v.tenant.razaoSocial,
        nomeFantasia: v.tenant.nomeFantasia,
        cnpj: v.tenant.cnpj,
        role: v.role,
        acesso: 'vinculado',
      }));
  }

  // Gera refresh token (não vinculado a empresa ainda)
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiraEm: refreshTokenExpiry(),
    },
  });

  return {
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
    },
    empresas,
    refreshToken,
  };
}

/**
 * Selecionar empresa: emite JWT com tenantId + role
 */
async function selecionarEmpresa(userId, perfil, tenantId) {
  let role = null;

  if (perfil !== 'admin_total') {
    const vinculo = await prisma.userTenantRole.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    if (!vinculo) {
      throw { status: 403, message: 'Você não tem acesso a esta empresa.' };
    }
    role = vinculo.role;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, razaoSocial: true, nomeFantasia: true, ativo: true },
  });

  if (!tenant || !tenant.ativo) {
    throw { status: 404, message: 'Empresa não encontrada.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nome: true, email: true, perfil: true },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    tenantId,
    role,
  });

  return { accessToken, tenant, role };
}

/**
 * Refresh: valida refresh token e emite novo access token
 */
async function refresh(refreshTokenRaw, userId) {
  if (!refreshTokenRaw || !userId) {
    throw { status: 401, message: 'Sessão inválida.' };
  }

  const tokenHash = hashRefreshToken(refreshTokenRaw);

  const stored = await prisma.refreshToken.findFirst({
    where: {
      userId,
      tokenHash,
      expiraEm: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!stored) {
    throw { status: 401, message: 'Sessão expirada. Faça login novamente.' };
  }

  // Não podemos reemitir o access token sem saber qual empresa está selecionada
  // O frontend deve re-selecionar a empresa após o refresh
  return {
    user: {
      id: stored.user.id,
      nome: stored.user.nome,
      email: stored.user.email,
      perfil: stored.user.perfil,
    },
  };
}

/**
 * Logout: remove refresh token
 */
async function logout(userId, refreshTokenRaw) {
  if (!refreshTokenRaw) return;
  const tokenHash = hashRefreshToken(refreshTokenRaw);
  await prisma.refreshToken.deleteMany({ where: { userId, tokenHash } });
}

/**
 * Hash de senha para cadastro
 */
async function hashSenha(senha) {
  return bcrypt.hash(senha, 12);
}

module.exports = { login, selecionarEmpresa, refresh, logout, hashSenha };
