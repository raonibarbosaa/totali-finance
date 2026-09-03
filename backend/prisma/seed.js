const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Totali@2026', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@totalicontabilidade.com.br' },
    update: {},
    create: {
      nome: 'Admin Totali',
      email: 'admin@totalicontabilidade.com.br',
      senhaHash: hash,
      perfil: 'admin_total',
      ativo: true,
    },
  });

  console.log('✅ Admin criado:', admin.email);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
