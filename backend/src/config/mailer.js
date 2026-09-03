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
async function sendMail({ to, subject, html, text, throwOnError = false }) {
  if (!process.env.SMTP_HOST) {
    console.warn('[MAIL] SMTP não configurado. E-mail não enviado:', subject);
    if (throwOnError) {
      throw new Error('SMTP não configurado no servidor.');
    }
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('[MAIL] Erro ao enviar e-mail:', err.message);
    if (throwOnError) throw err;
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


/**
 * Envia o link de redefinição de senha
 */
async function enviarResetSenha({ to, nome, link, minutos }) {
  await sendMail({
    to,
    throwOnError: true,
    subject: '[TotaliFinance] Redefinição de senha',
    text:
      `Olá, ${nome}.\n\n` +
      `Recebemos um pedido para redefinir a sua senha do TotaliFinance.\n` +
      `Acesse o link abaixo (válido por ${minutos} minutos):\n\n${link}\n\n` +
      `Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
        <div style="background:#1e3a5f;padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <span style="color:#fff;font-size:22px;font-weight:bold">totali</span><span style="color:#C4973A;font-size:22px">·</span><span style="color:#cbd5e1;font-size:22px">finance</span>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
          <h2 style="margin-top:0;font-size:18px;color:#1e3a5f">Redefinição de senha</h2>
          <p>Olá, <strong>${nome}</strong>.</p>
          <p>Recebemos um pedido para redefinir a senha da sua conta no TotaliFinance.</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:bold">
              Criar nova senha
            </a>
          </p>
          <p style="font-size:13px;color:#64748b">
            Este link é válido por <strong>${minutos} minutos</strong> e só pode ser usado uma vez.
          </p>
          <p style="font-size:13px;color:#64748b">
            Se não foi você quem solicitou, ignore este e-mail — sua senha continua a mesma.
          </p>
          <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin-top:20px">
            Se o botão não funcionar, copie e cole no navegador:<br>${link}
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
          <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
            Totali Contabilidade · Itabaiana/SE
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendMail, notificarExportacao, enviarResetSenha };
