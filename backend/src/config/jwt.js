const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const RESET_EXPIRES_MIN = parseInt(process.env.RESET_TOKEN_EXPIRES_MIN) || 60;

/**
 * Gera access token JWT com payload do usuário + empresa selecionada
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

/**
 * Gera refresh token aleatório (não-JWT)
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash do refresh token para armazenar no banco
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verifica e decodifica access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Gera token opaco para redefinição de senha (enviado por e-mail)
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash do token de redefinição para armazenar no banco
 */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Data de expiração do token de redefinição (padrão: 60 minutos)
 */
function resetTokenExpiry(minutos = RESET_EXPIRES_MIN) {
  return new Date(Date.now() + minutos * 60 * 1000);
}

/**
 * Data de expiração do refresh token
 */
function refreshTokenExpiry() {
  const days = parseInt(REFRESH_EXPIRES) || 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  refreshTokenExpiry,
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
  RESET_EXPIRES_MIN,
};
