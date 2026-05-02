import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // Estado
      user: null,           // { id, nome, email, perfil }
      accessToken: null,    // JWT com tenantId + role
      tenant: null,         // { id, razaoSocial, nomeFantasia }
      role: null,           // 1 | 2 | 3 | null (admin_total)
      empresas: [],         // lista após login, antes de selecionar empresa

      // Ações
      setUser: (user) => set({ user }),

      setEmpresas: (empresas) => set({ empresas }),

      setToken: (accessToken) => set({ accessToken }),

      setTenant: (tenant, role, accessToken) =>
        set({ tenant, role, accessToken }),

      clearTenant: () =>
        set({ tenant: null, role: null, accessToken: null }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          tenant: null,
          role: null,
          empresas: [],
        }),

      // Helpers
      isAdminTotal: () => get().user?.perfil === 'admin_total',
      isAdminTotali: () =>
        ['admin_total', 'admin_funcionario'].includes(get().user?.perfil),
      hasRole: (minRole) => {
        if (get().user?.perfil === 'admin_total') return true;
        return get().role !== null && get().role <= minRole;
      },
    }),
    {
      name: 'totali-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        role: state.role,
        // accessToken NÃO é persistido (segurança)
        // empresas NÃO é persistida
      }),
    }
  )
);

export default useAuthStore;
