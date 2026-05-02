import useAuthStore from '../store/authStore';

/**
 * Hook para verificar permissões na UI.
 *
 * Uso:
 *   const { hasRole, isAdminTotal, perfil } = useRole();
 *   if (hasRole(1)) // somente nível gerencial
 *   if (hasRole(2)) // operacional ou superior
 */
export function useRole() {
  const { user, role } = useAuthStore();

  const isAdminTotal = user?.perfil === 'admin_total';
  const isAdminTotali = ['admin_total', 'admin_funcionario'].includes(user?.perfil);

  function hasRole(minRole) {
    if (isAdminTotal) return true;
    if (role === null) return false;
    return role <= minRole;
  }

  return {
    hasRole,
    isAdminTotal,
    isAdminTotali,
    perfil: user?.perfil,
    role,
  };
}

export default useRole;
