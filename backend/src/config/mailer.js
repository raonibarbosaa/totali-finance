const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envia e-mail
 */
async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[MAIL] SMTP não configurado. E-mail não enviado:', subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('[MAIL] Erro ao enviar e-mail:', err.message);
  }
}

/**
 * Notifica o escritório sobre exportação gerada
 */
async function notificarExportacao({ empresaNome, periodo, usuario }) {
  await sendMail({
    to: process.env.EMAIL_ADMIN,
    subject: `[TotaliFinance] Nova exportação gerada — ${empresaNome}`,
    html: `
      <h2>Nova exportação para o Domínio Contábil</h2>
      <p><strong>Empresa:</strong> ${empresaNome}</p>
      <p><strong>Período:</strong> ${periodo}</p>
      <p><strong>Gerada por:</strong> ${usuario}</p>
      <p>Acesse o painel para visualizar os detalhes.</p>
    `,
  });
}

module.exports = { sendMail, notificarExportacao };
