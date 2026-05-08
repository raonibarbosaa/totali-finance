require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./modules/auth/auth.routes');
const tenantRoutes = require('./modules/tenants/tenants.routes');
const userRoutes = require('./modules/users/users.routes');

const app = express();

// ── Trust proxy (atrás do nginx) ──────────────────────
// Necessário para express-rate-limit identificar IPs corretamente
// via X-Forwarded-For. '1' = confia apenas no primeiro proxy (nginx).
app.set('trust proxy', 1);

// ── Segurança ─────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting global ──────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em breve.' },
});
app.use(limiter);

// Rate limit específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// ── Parsers ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Health check ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── Rotas ─────────────────────────────────────────────
app.use('/api/auth', loginLimiter, authRoutes);
app.use("/api/tenants", tenantRoutes);
const titlesRoutes = require("./modules/titles/titles.routes");
app.use("/api/titles", titlesRoutes);
const suppliersRoutes = require("./modules/suppliers/suppliers.routes");
app.use("/api/suppliers", suppliersRoutes);
const customersRoutes = require("./modules/customers/customers.routes");
app.use("/api/customers", customersRoutes);
const recurringTitlesRoutes = require("./modules/recurring-titles/recurring-titles.routes");
app.use("/api/recurring-titles", recurringTitlesRoutes);
app.use('/api/users', userRoutes);

// ── Rotas Etapas 2 e 3 ────────────────────────────────
const bankAccountsRoutes = require('./modules/bank-accounts/bank-accounts.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const ofxPatternsRoutes = require('./modules/ofx-patterns/ofx-patterns.routes');
const companySettingsRoutes = require('./modules/company-settings/company-settings.routes');
const transactionsRoutes = require('./modules/transactions/transactions.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
app.use('/api/bank-accounts', bankAccountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/ofx-patterns', ofxPatternsRoutes);
app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Rotas Etapas 4 a 10 ───────────────────────────────
const payablesRoutes = require('./modules/payables/payables.routes');
const ofxRoutes = require('./modules/ofx/ofx.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const stockRoutes = require('./modules/stock/stock.routes');
const exportRoutes = require('./modules/export/export.routes');
const periodsRoutes = require('./modules/periods/periods.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const adminRoutes = require('./modules/admin/admin.routes');
app.use('/api/payables', payablesRoutes);
app.use('/api/ofx', ofxRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

// ── Error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor.'
    : err.message;
  res.status(status).json({ success: false, error: message });
});

// ── Iniciar servidor ──────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TotaliFinance API rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
