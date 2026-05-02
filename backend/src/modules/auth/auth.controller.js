const authService = require('./auth.service');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
  path: '/',
};

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
    }

    const result = await authService.login(email, senha);

    // Refresh token em cookie HttpOnly
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    res.cookie('userId', result.user.id, { ...COOKIE_OPTIONS, httpOnly: false });

    res.json({
      success: true,
      data: {
        user: result.user,
        empresas: result.empresas,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function selecionarEmpresa(req, res) {
  try {
    const { tenantId } = req.body;
    const userId = req.cookies?.userId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Selecione uma empresa.' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }
    const userObj = await require('../../config/database').user.findUnique({ where: { id: userId } });
    if (!userObj) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado.' });
    }
    const result = await authService.selecionarEmpresa(
      userId,
      userObj.perfil,
      tenantId
    );

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        tenant: result.tenant,
        role: result.role,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const userId = req.cookies?.userId;

    const result = await authService.refresh(refreshToken, userId);

    res.json({ success: true, data: { user: result.user } });
  } catch (err) {
    res.clearCookie('refreshToken');
    res.clearCookie('userId');
    res.status(err.status || 401).json({ success: false, error: err.message });
  }
}

async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const userId = req.cookies?.userId;

    await authService.logout(userId, refreshToken);

    res.clearCookie('refreshToken');
    res.clearCookie('userId');
    res.json({ success: true, data: { message: 'Logout realizado com sucesso.' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function me(req, res) {
  res.json({
    success: true,
    data: {
      user: req.user,
      tenantId: req.tenantId,
      role: req.role,
    },
  });
}

module.exports = { login, selecionarEmpresa, refresh, logout, me };
