const prisma = require('../../config/database');

async function listar({ page = 1, limit = 50, search = '' }) {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { razaoSocial: { contains: search, mode: 'insensitive' } },
          { nomeFantasia: { contains: search, mode: 'insensitive' } },
          { cnpj: { contains: search } },
        ],
      }
    : {};

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { razaoSocial: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        codigoFilial: true,
        regime: true,
        ativo: true,
        criadoEm: true,
        _count: { select: { userRoles: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return { tenants, total, page, limit, pages: Math.ceil(total / limit) };
}

async function buscarPorId(id) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: {
          user: { select: { id: true, nome: true, email: true, perfil: true, ativo: true } },
        },
      },
    },
  });
  if (!tenant) throw { status: 404, message: 'Empresa não encontrada.' };
  return tenant;
}

async function criar(data) {
  const existe = await prisma.tenant.findUnique({ where: { cnpj: data.cnpj } });
  if (existe) throw { status: 409, message: 'CNPJ já cadastrado.' };

  return prisma.tenant.create({
    data: {
      razaoSocial: data.razaoSocial,
      nomeFantasia: data.nomeFantasia || null,
      cnpj: data.cnpj,
      codigoFilial: data.codigoFilial || null,
      regime: data.regime || 'caixa',
    },
  });
}

async function atualizar(id, data) {
  await buscarPorId(id);
  return prisma.tenant.update({
    where: { id },
    data: {
      razaoSocial: data.razaoSocial,
      nomeFantasia: data.nomeFantasia || null,
      cnpj: data.cnpj,
      codigoFilial: data.codigoFilial || null,
      regime: data.regime,
      ativo: data.ativo,
    },
  });
}

async function alterarStatus(id, ativo) {
  await buscarPorId(id);
  return prisma.tenant.update({ where: { id }, data: { ativo } });
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarStatus };
