require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Cria usuário Admin Total padrão
  const email = 'admin@totalicontabilidade.com.br';
  const senha = 'Totali@2026';

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) {
    console.log('⚠️  Admin total já existe. Pulando criação.');
  } else {
    const senhaHash = await bcrypt.hash(senha, 12);
    await prisma.user.create({
      data: {
        nome: 'Administrador Totali',
        email,
        senhaHash,
        perfil: 'admin_total',
      },
    });
    console.log('✅ Admin total criado:');
    console.log(`   E-mail: ${email}`);
    console.log(`   Senha:  ${senha}`);
    console.log('   ⚠️  TROQUE A SENHA NO PRIMEIRO ACESSO!');
  }

  console.log('\n🎉 Seed concluído!');
  await prisma.$disconnect();
}

seed().catch(async (err) => {
  console.error('❌ Erro no seed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
