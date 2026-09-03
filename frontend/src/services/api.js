import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // envia cookies (refresh token)
  timeout: 15000,
});

// ── Request interceptor: adiciona Bearer token ────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: 401 → logout + redirect ────
//
// Política de sessão (Opção 2 — segurança em primeiro lugar):
// - Não há refresh transparente do access token.
// - Qualquer 401 desloga o usuário e o manda para /login.
// - O usuário precisa re-logar e re-selecionar a empresa.
// - Endpoints de auth (login/refresh/logout) são exceções para evitar loops.
function isAuthEndpoint(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // 401 fora de endpoints de auth → sessão inválida/expirada → logout
    if (status === 401 && !isAuthEndpoint(url) && !isRedirecting) {
      isRedirecting = true;

      // Mostra o motivo real quando o servidor informa (ex.: acesso bloqueado
      // pelo admin) — 'sessão expirada' confundiria quem acabou de ser bloqueado.
      const motivo = error.response?.data?.error || 'Sessão expirada. Faça login novamente.';

      try {
        useAuthStore.getState().logout();
      } catch (_) {
        // ignora qualquer erro do store — vamos redirecionar de qualquer jeito
      }

      // Mostra mensagem ao usuário antes de redirecionar.
      // setTimeout garante que o alert seja exibido fora do ciclo do axios.
      setTimeout(() => {
        try {
          // eslint-disable-next-line no-alert
          alert(motivo);
        } finally {
          window.location.href = '/login';
        }
      }, 0);
    }

    return Promise.reject(error);
  }
);

export default api;
