import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, FileUp, Landmark,
  Tags, GitBranch, Package, BarChart2, FileText,
  Lock, Users, Building2, ChevronDown, LogOut,
  CreditCard, Wallet, Settings, BookOpen, Truck, UserCircle, Repeat,
  ListChecks, X, Cloud
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useRole from '../../hooks/useRole';
import api from '../../services/api';

/* ── Ícone da marca (SVG inline — navy + gold) ─────────────────────── */
function TotaliIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill="#1a3353"/>
      <rect x="44" y="18" width="12" height="64" rx="6" fill="#C4973A"/>
      <rect x="18" y="44" width="64" height="12" rx="6" fill="#C4973A"/>
    </svg>
  );
}

/* ── Link de navegação ─────────────────────────────────────────────── */
function SidebarLink({ to, icon: Icon, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'active' : ''}`
      }
    >
      <Icon size={17} />
      <span>{children}</span>
    </NavLink>
  );
}

/* ── Seção do menu ─────────────────────────────────────────────────── */
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

/* ── Sidebar principal ─────────────────────────────────────────────── */
export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuthStore();
  const { hasRole, isAdminTotal, isAdminTotali } = useRole();

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  }

  // Fecha o sidebar ao clicar num link (mobile)
  function handleLinkClick() {
    if (window.innerWidth < 768) onClose();
  }

  return (
    <aside
      className={[
        // Base — mobile: fixed overlay; desktop: relative sempre visível
        'fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0',
        'bg-navy-800 flex flex-col',
        'transition-transform duration-300 ease-in-out',
        // Mobile: abre/fecha; desktop: sempre visível
        open ? 'translate-x-0' : '-translate-x-full',
        'md:relative md:translate-x-0 md:z-auto md:w-60',
      ].join(' ')}
    >

      {/* Logo + botão fechar (mobile) */}
      <div className="px-5 py-5 border-b border-navy-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TotaliIcon size={34} />
          <div>
            <p className="font-display font-semibold text-white text-sm leading-tight">
              TotaliFinance
            </p>
            <p className="text-[10px] text-navy-400 leading-tight">Totali Contabilidade</p>
          </div>
        </div>

        {/* Botão X — só no mobile */}
        <button
          onClick={onClose}
          className="md:hidden text-navy-400 hover:text-white p-1 rounded transition-colors"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Empresa ativa */}
      {tenant && (
        <div
          className="mx-3 mt-3 px-3 py-2 bg-navy-700/50 rounded-lg cursor-pointer
                     hover:bg-navy-700 transition-colors group"
          onClick={() => { navigate('/selecionar-empresa'); handleLinkClick(); }}
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
          <SidebarLink to="/app/dashboard" icon={LayoutDashboard} onClick={handleLinkClick}>
            Dashboard
          </SidebarLink>
        </SidebarSection>

        <SidebarSection title="Financeiro">
          <SidebarLink to="/app/lancamentos" icon={ArrowLeftRight} onClick={handleLinkClick}>Lançamentos</SidebarLink>
          <SidebarLink to="/app/contas-pagar" icon={CreditCard} onClick={handleLinkClick}>Contas a Pagar</SidebarLink>
          <SidebarLink to="/app/contas-receber" icon={Wallet} onClick={handleLinkClick}>Contas a Receber</SidebarLink>
        </SidebarSection>

        <SidebarLink to="/app/recorrencias-fixas?tipo=pagar"   icon={Repeat}    onClick={handleLinkClick}>Despesas Fixas</SidebarLink>
        <SidebarLink to="/app/recorrencias-fixas?tipo=receber" icon={FileText}  onClick={handleLinkClick}>Contratos Recorrentes</SidebarLink>

        <SidebarSection title="Cadastros">
          <SidebarLink to="/app/fornecedores" icon={Truck}       onClick={handleLinkClick}>Fornecedores</SidebarLink>
          <SidebarLink to="/app/clientes"     icon={UserCircle}  onClick={handleLinkClick}>Clientes</SidebarLink>
        </SidebarSection>

        {hasRole(2) && (
          <SidebarSection title="Bancário">
            <SidebarLink to="/app/contas-bancarias" icon={Landmark}    onClick={handleLinkClick}>Contas Bancárias</SidebarLink>
            <SidebarLink to="/app/extrato"          icon={BookOpen}    onClick={handleLinkClick}>Extrato Bancário</SidebarLink>
            <SidebarLink to="/app/importacao-ofx"   icon={FileUp}      onClick={handleLinkClick}>Importar OFX</SidebarLink>
            <SidebarLink to="/app/integracao-drive" icon={Cloud}       onClick={handleLinkClick}>Drive Automático</SidebarLink>
            <SidebarLink to="/app/conciliacao"      icon={ListChecks}  onClick={handleLinkClick}>Conciliação</SidebarLink>
          </SidebarSection>
        )}

        {hasRole(1) && (
          <>
            <SidebarSection title="Configurações">
              <SidebarLink to="/app/categorias"   icon={Tags}     onClick={handleLinkClick}>Categorias</SidebarLink>
              <SidebarLink to="/app/padroes-ofx"  icon={GitBranch} onClick={handleLinkClick}>Padrões OFX</SidebarLink>
              <SidebarLink to="/app/configuracao" icon={Settings}  onClick={handleLinkClick}>Configuração</SidebarLink>
              <SidebarLink to="/app/estoque"      icon={Package}   onClick={handleLinkClick}>Estoque</SidebarLink>
            </SidebarSection>

            <SidebarSection title="Relatórios">
              <SidebarLink to="/app/relatorios/dre" icon={BarChart2} onClick={handleLinkClick}>DRE</SidebarLink>
              <SidebarLink to="/app/relatorios/dfc" icon={BarChart2} onClick={handleLinkClick}>DFC</SidebarLink>
            </SidebarSection>

            <SidebarSection title="Escritório">
              <SidebarLink to="/app/exportacao-dominio" icon={FileText} onClick={handleLinkClick}>Exportar Domínio</SidebarLink>
              <SidebarLink to="/app/fechamento"         icon={Lock}     onClick={handleLinkClick}>Fechamento</SidebarLink>
              <SidebarLink to="/app/usuarios"           icon={Users}    onClick={handleLinkClick}>Usuários</SidebarLink>
            </SidebarSection>
          </>
        )}

        {isAdminTotali && (
          <SidebarSection title="Administração">
            <SidebarLink to="/admin/dashboard" icon={LayoutDashboard} onClick={handleLinkClick}>Painel Totali</SidebarLink>
            <SidebarLink to="/admin/clientes"  icon={Building2}       onClick={handleLinkClick}>Clientes</SidebarLink>
            {isAdminTotal && (
              <SidebarLink to="/admin/usuarios" icon={Users} onClick={handleLinkClick}>Usuários Totali</SidebarLink>
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
