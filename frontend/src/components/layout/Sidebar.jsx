import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, FileUp, Landmark,
  Tags, GitBranch, Package, BarChart2, FileText,
  Lock, Users, Building2, ChevronDown, LogOut,
  CreditCard, Wallet, Settings, BookOpen
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useRole from '../../hooks/useRole';
import api from '../../services/api';

function SidebarLink({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'active' : ''}`
      }
    >
      <Icon size={17} />
      <span>{children}</span>
    </NavLink>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div className="mb-4">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-navy-400">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuthStore();
  const { hasRole, isAdminTotal, isAdminTotali } = useRole();

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  }

  return (
    <aside className="w-60 min-h-screen bg-navy-800 flex flex-col flex-shrink-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-navy-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-display font-bold text-sm">T</span>
          </div>
          <div>
            <p className="font-display font-semibold text-white text-sm leading-tight">
              TotaliFinance
            </p>
            <p className="text-[10px] text-navy-400 leading-tight">Totali Contabilidade</p>
          </div>
        </div>
      </div>

      {/* Empresa ativa */}
      {tenant && (
        <div
          className="mx-3 mt-3 px-3 py-2 bg-navy-700/50 rounded-lg cursor-pointer
                     hover:bg-navy-700 transition-colors group"
          onClick={() => navigate('/selecionar-empresa')}
          title="Trocar empresa"
        >
          <p className="text-[10px] text-navy-400 font-medium">Empresa ativa</p>
          <p className="text-xs text-white font-medium truncate mt-0.5">
            {tenant.nomeFantasia || tenant.razaoSocial}
          </p>
          <p className="text-[10px] text-navy-400 mt-0.5 flex items-center gap-1
                        group-hover:text-navy-300 transition-colors">
            Trocar <ChevronDown size={10} />
          </p>
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">

        <SidebarSection title="Geral">
          <SidebarLink to="/app/dashboard" icon={LayoutDashboard}>Dashboard</SidebarLink>
        </SidebarSection>

        {/* Nível 3+ — Financeiro básico */}
        <SidebarSection title="Financeiro">
          <SidebarLink to="/app/lancamentos" icon={ArrowLeftRight}>Lançamentos</SidebarLink>
          <SidebarLink to="/app/contas-pagar" icon={CreditCard}>Contas a Pagar</SidebarLink>
          <SidebarLink to="/app/contas-receber" icon={Wallet}>Contas a Receber</SidebarLink>
        </SidebarSection>

        {/* Nível 2+ — Bancário */}
        {hasRole(2) && (
          <SidebarSection title="Bancário">
            <SidebarLink to="/app/contas-bancarias" icon={Landmark}>Contas Bancárias</SidebarLink>
            <SidebarLink to="/app/extrato" icon={BookOpen}>Extrato Bancário</SidebarLink>
            <SidebarLink to="/app/importacao-ofx" icon={FileUp}>Importar OFX</SidebarLink>
          </SidebarSection>
        )}

        {/* Nível 1 — Configurações */}
        {hasRole(1) && (
          <>
            <SidebarSection title="Configurações">
              <SidebarLink to="/app/categorias" icon={Tags}>Categorias</SidebarLink>
              <SidebarLink to="/app/padroes-ofx" icon={GitBranch}>Padrões OFX</SidebarLink>
              <SidebarLink to="/app/configuracao" icon={Settings}>Configuração</SidebarLink>
              <SidebarLink to="/app/estoque" icon={Package}>Estoque</SidebarLink>
            </SidebarSection>

            <SidebarSection title="Relatórios">
              <SidebarLink to="/app/relatorios/dre" icon={BarChart2}>DRE</SidebarLink>
              <SidebarLink to="/app/relatorios/dfc" icon={BarChart2}>DFC</SidebarLink>
            </SidebarSection>

            <SidebarSection title="Escritório">
              <SidebarLink to="/app/exportacao-dominio" icon={FileText}>Exportar Domínio</SidebarLink>
              <SidebarLink to="/app/fechamento" icon={Lock}>Fechamento</SidebarLink>
              <SidebarLink to="/app/usuarios" icon={Users}>Usuários</SidebarLink>
            </SidebarSection>
          </>
        )}

        {/* Admin Totali */}
        {isAdminTotali && (
          <SidebarSection title="Administração">
            <SidebarLink to="/admin/dashboard" icon={LayoutDashboard}>Painel Totali</SidebarLink>
            <SidebarLink to="/admin/clientes" icon={Building2}>Clientes</SidebarLink>
            {isAdminTotal && (
              <SidebarLink to="/admin/usuarios" icon={Users}>Usuários Totali</SidebarLink>
            )}
          </SidebarSection>
        )}
      </nav>

      {/* Usuário logado */}
      <div className="px-3 pb-4 border-t border-navy-700 pt-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center
                          text-white text-xs font-semibold flex-shrink-0">
            {user?.nome?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.nome}</p>
            <p className="text-[10px] text-navy-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-navy-400 hover:text-white transition-colors p-1 rounded
                       hover:bg-navy-700"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
