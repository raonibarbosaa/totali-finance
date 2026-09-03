const { verifyAccessToken } = require('../config/jwt');
const prisma = require('../config/database');

/**
 * Valida o JWT e injeta user, tenantId e role no request.
 * O token deve vir no header: Authorization: Bearer <token>
 *
 * Além do token, confere no banco se o usuário continua ativo — é isso que
 * faz o bloqueio valer na hora, e não só quando o token de 24h expira.
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token de acesso não fornecido.' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // Consulta por chave primária: barata e obrigatória para o bloqueio imediato
    const dono = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { ativo: true },
    });

    if (!dono) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado.' });
    }

    if (!dono.ativo) {
      return res.status(401).json({
        success: false,
        error: 'Seu acesso foi bloqueado. Fale com o escritório.',
        code: 'USUARIO_BLOQUEADO',
      });
    }

    // Injeta dados do token no request
    req.user = {
      id: decoded.userId,
      perfil: decoded.perfil,
      nome: decoded.nome,
      email: decoded.email,
    };
    req.tenantId = decoded.tenantId || null;
    req.role = decoded.role || null;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expirado.', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, error: 'Token inválido.' });
    }
    // Falha inesperada (banco fora do ar, por exemplo) não é "token inválido":
    // devolver 401 aqui deslogaria todo mundo sem motivo.
    console.error('[AUTH] Erro ao validar sessão:', err.message);
    return res.status(500).json({ success: false, error: 'Erro ao validar a sessão.' });
  }
}

module.exports = authMiddleware;
