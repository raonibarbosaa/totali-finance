const { verifyAccessToken } = require('../config/jwt');

/**
 * Valida o JWT e injeta user, tenantId e role no request.
 * O token deve vir no header: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token de acesso não fornecido.' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

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
    return res.status(401).json({ success: false, error: 'Token inválido.' });
  }
}

module.exports = authMiddleware;
