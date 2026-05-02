# TotaliFinance

Sistema SaaS de controle financeiro empresarial com exportação para Domínio Contábil.
Desenvolvido pela **Totali Contabilidade — Itabaiana/SE**.

---

## Etapa atual: 1 — Fundação e Autenticação

✅ Estrutura de projeto completa  
✅ Banco de dados PostgreSQL com Prisma  
✅ Autenticação JWT + Refresh Token  
✅ Multi-tenant com isolamento LGPD  
✅ Múltiplas empresas por usuário com níveis de acesso  
✅ Login → Seleção de empresa → JWT com role  
✅ Painel Admin Totali  
✅ Cadastro de clientes e usuários  
✅ Docker Compose com Nginx + SSL  

---

## Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 20+ (apenas para desenvolvimento local)
- Domínio apontando para o IP do servidor (para SSL)

---

## Deploy em produção (VPS)

```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/totali-finance.git
cd totali-finance

# 2. Criar arquivo .env a partir do exemplo
cp .env.example .env
nano .env   # edite as variáveis (senhas, SMTP, etc.)

# 3. Subir os serviços
docker compose up -d

# 4. Verificar se está rodando
docker compose ps
docker compose logs backend

# 5. Obter certificado SSL (apenas na primeira vez)
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email financeiro@totalicontabilidade.com.br \
  --agree-tos \
  --no-eff-email \
  -d app.totalicontabilidade.com.br

# 6. Reiniciar Nginx para carregar o SSL
docker compose restart nginx
```

### Primeiro acesso

```
URL:   https://app.totalicontabilidade.com.br
Login: admin@totalicontabilidade.com.br
Senha: Totali@2026

⚠️  TROQUE A SENHA NO PRIMEIRO ACESSO!
```

---

## Desenvolvimento local

```bash
# Backend
cd backend
cp .env.example .env
# edite .env com as configurações locais
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:5173

---

## Atualização do sistema

```bash
git pull
docker compose up --build -d
```

---

## Backup do banco de dados

```bash
# Backup manual
docker exec totali_postgres pg_dump -U totali totalifinance > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i totali_postgres psql -U totali totalifinance < backup_20260401.sql
```

### Backup automático diário (adicionar ao crontab do servidor)

```cron
0 2 * * * docker exec totali_postgres pg_dump -U totali totalifinance > /backups/totali_$(date +\%Y\%m\%d).sql 2>&1
# Manter apenas 30 dias
0 3 * * * find /backups -name "totali_*.sql" -mtime +30 -delete
```

---

## Estrutura do projeto

```
totali-finance/
├── backend/          Node.js + Express + Prisma
├── frontend/         React + Vite + Tailwind
├── nginx/            Configuração do proxy reverso
├── docker-compose.yml
└── .env.example
```

---

## Níveis de acesso

| Nível | Nome | Permissões |
|---|---|---|
| 1 | Gerencial | Acesso total |
| 2 | Operacional | Lançamentos + Títulos + OFX + Extrato |
| 3 | Básico | Lançamentos + Títulos |

---

## Exportação para Domínio Contábil

Formato do TXT gerado:
```
DD/MM/AAAA;ContaDébito;ContaCrédito;Valor,Centavos;CódHistórico;Complemento;CódFilial;CentroCustoD;CentroCustoC
```

Exemplo:
```
05/04/2026;15;245;1250,50;10;PAGTO NF 5542;1;;
```

---

## Suporte

Totali Contabilidade — Itabaiana/SE  
financeiro@totalicontabilidade.com.br
