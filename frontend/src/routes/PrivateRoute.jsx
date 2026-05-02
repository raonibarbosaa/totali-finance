import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * Protege rotas que exigem usuário logado.
 * Se não tiver user → /login
 * Se tiver user mas sem empresa selecionada → /selecionar-empresa
 */
export function PrivateRoute({ children, requireTenant = true }) {
  const { user, tenant } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireTenant && !tenant) {
    return <Navigate to="/selecionar-empresa" replace />;
  }

  return children;
}

/**
 * Protege rotas que exigem nível mínimo de acesso.
 * minRole: 1 = Gerencial | 2 = Operacional | 3 = Básico
 */
export function RoleRoute({ children, minRole }) {
  const { user, role } = useAuthStore();

  const isAdminTotal = user?.perfil === 'admin_total';
  if (isAdminTotal) return children;

  if (!role || role > minRole) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}

/**
 * Rota exclusiva para Admin Total
 */
export function AdminRoute({ children }) {
  const { user } = useAuthStore();

  if (user?.perfil !== 'admin_total') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}

export default PrivateRoute;
