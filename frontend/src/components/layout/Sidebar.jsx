import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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

/* ── Onde guardamos quais grupos ficaram abertos ───────────────────── */
const STORAGE_KEY = 'totali.sidebar.secoes';

/* ── Estrutura do menu ─────────────────────────────────────────────────
 * Declarada como dados (e não como JSX repetido) para conseguirmos
 * descobrir a qual grupo pertence a página atual e abri-lo sozinho.
 * `visivel` é opcional — quando ausente, o grupo/item aparece para todos.
 * ------------------------------------------------------------------- */
const SECOES = [
  {
    id: 'geral',
    titulo: 'Geral',
    itens: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    itens: [
      { to: '/app/lancamentos',    icon: ArrowLeftRight, label: 'Lançamentos' },
      { to: '/app/contas-pagar',   icon: CreditCard,     label: 'Contas a Pagar' },
      { to: '/app/contas-receber', icon: Wallet,         label: 'Contas a Receber' },
      { to: '/app/recorrencias-fixas?tipo=pagar',   icon: Repeat,   label: 'Despesas Fixas' },
      { to: '/app/recorrencias-fixas?tipo=receber', icon: FileText, label: 'Contratos Recorrentes' },
    ],
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    itens: [
      { to: '/app/fornecedores', icon: Truck,      label: 'Fornecedores' },
      { to: '/app/clientes',     icon: UserCircle, label: 'Clientes' },
    ],
  },
  {
    id: 'bancario',
    titulo: 'Bancário',
    visivel: ({ hasRole }) => hasRole(2),
    itens: [
      { to: '/app/contas-bancarias', icon: Landmark,   label: 'Contas Bancárias' },
      { to: '/app/extrato',          icon: BookOpen,   label: 'Extrato Bancário' },
      { to: '/app/importacao-ofx',   icon: FileUp,     label: 'Importar OFX' },
      { to: '/app/integracao-drive', icon: Cloud,      label: 'Drive Automático' },
      { to: '/app/conciliacao',      icon: ListChecks, label: 'Conciliação' },
    ],
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações',
    visivel: ({ hasRole }) => hasRole(1),
    itens: [
      { to: '/app/categorias',   icon: Tags,      label: 'Categorias' },
      { to: '/app/padroes-ofx',  icon: GitBranch, label: 'Padrões OFX' },
      { to: '/app/configuracao', icon: Settings,  label: 'Configuração' },
      { to: '/app/estoque',      icon: Package,   label: 'Estoque' },
    ],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios',
    visivel: ({ hasRole }) => hasRole(1),
    itens: [
      { to: '/app/relatorios/dre', icon: BarChart2, label: 'DRE' },
      { to: '/app/relatorios/dfc', icon: BarChart2, label: 'DFC' },
    ],
  },
  {
    id: 'escritorio',
    titulo: 'Escritório',
    visivel: ({ hasRole }) => hasRole(1),
    itens: [
      { to: '/app/exportacao-dominio', icon: FileText, label: 'Exportar Domínio' },
      { to: '/app/fechamento',         icon: Lock,     label: 'Fechamento' },
      { to: '/app/usuarios',           icon: Users,    label: 'Usuários' },
    ],
  },
  {
    id: 'administracao',
    titulo: 'Administração',
    visivel: ({ isAdminTotali }) => isAdminTotali,
    itens: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Painel Totali' },
      { to: '/admin/clientes',  icon: Building2,       label: 'Empresas' },
      {
        to: '/admin/usuarios',
        icon: Users,
        label: 'Usuários Totali',
        visivel: ({ isAdminTotal }) => isAdminTotal,
      },
    ],
  },
];

/* ── Qual grupo contém a rota atual ────────────────────────────────── */
function secaoDaRota(pathname) {
  const secao = SECOES.find(s =>
    s.itens.some(item => item.to.split('?')[0] === pathname)
  );
  return secao ? secao.id : null;
}

/* ── Preferência do navegador (pode falhar em aba anônima) ─────────── */
function lerSecoesSalvas() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (!salvo) return null;
    const ids = JSON.parse(salvo);
    return Array.isArray(ids) ? ids : null;
  } catch (_) {
    return null;
  }
}

function salvarSecoes(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (_) {
    // storage bloqueado — o menu segue funcionando, só não lembra
  }
}

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

/* ── Grupo recolhível ──────────────────────────────────────────────────
 * A altura anima pelo truque de grid (0fr → 1fr), que dispensa medir o
 * conteúdo com JS. `invisible` quando fechado tira os links da navegação
 * por Tab e dos leitores de tela.
 * ------------------------------------------------------------------- */
function SidebarSection({ id, titulo, aberta, onToggle, children }) {
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        aria-controls={`secao-${id}`}
        className="sidebar-section-title"
      >
        <span>{titulo}</span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={`secao-${id}`}
        className={`grid transition-all duration-200 ease-in-out ${
          aberta ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 invisible'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-0.5 pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar principal ─────────────────────────────────────────────── */
export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, tenant, empresas, logout } = useAuthStore();
  const permissoes = useRole();

  // Primeiro acesso: abre só o grupo da página atual.
  // Depois: restaura exatamente o que o usuário deixou.
  const [abertas, setAbertas] = useState(() => {
    const salvas = lerSecoesSalvas();
    if (salvas) return salvas;
    const atual = secaoDaRota(pathname);
    return atual ? [atual] : [];
  });

  useEffect(() => {
    salvarSecoes(abertas);
  }, [abertas]);

  // Ao navegar para uma página de OUTRO grupo, abre esse grupo sozinho —
  // sem reabrir o grupo que o usuário acabou de fechar de propósito.
  const secaoAnterior = useRef(secaoDaRota(pathname));
  useEffect(() => {
    const secao = secaoDaRota(pathname);
    if (secao && secao !== secaoAnterior.current) {
      setAbertas(prev => (prev.includes(secao) ? prev : [...prev, secao]));
    }
    secaoAnterior.current = secao;
  }, [pathname]);

  function toggleSecao(id) {
    setAbertas(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  }

  // Fecha o sidebar ao clicar num link (mobile)
  function handleLinkClick() {
    if (window.innerWidth < 768) onClose();
  }

  // Com uma empresa só não há o que trocar — o bloco vira apenas informativo.
  const podeTrocarEmpresa = (empresas?.length || 0) > 1;

  const secoesVisiveis = SECOES.filter(s => !s.visivel || s.visivel(permissoes));

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

      {/* Empresa ativa — só vira botão de troca quando há mais de uma */}
      {tenant && (
        podeTrocarEmpresa ? (
          <div
            className="mx-3 mt-3 px-3 py-2 bg-navy-700/50 rounded-lg cursor-pointer
                       hover:bg-navy-700 transition-colors group"
            onClick={() => { navigate(user?.acesso === 'total' ? '/admin/dashboard' : '/selecionar-empresa'); handleLinkClick(); }}
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
        ) : (
          <div className="mx-3 mt-3 px-3 py-2 bg-navy-700/50 rounded-lg">
            <p className="text-[10px] text-navy-400 font-medium">Empresa ativa</p>
            <p className="text-xs text-white font-medium truncate mt-0.5">
              {tenant.nomeFantasia || tenant.razaoSocial}
            </p>
          </div>
        )
      )}

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {secoesVisiveis.map(secao => (
          <SidebarSection
            key={secao.id}
            id={secao.id}
            titulo={secao.titulo}
            aberta={abertas.includes(secao.id)}
            onToggle={() => toggleSecao(secao.id)}
          >
            {secao.itens
              .filter(item => !item.visivel || item.visivel(permissoes))
              .map(item => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  onClick={handleLinkClick}
                >
                  {item.label}
                </SidebarLink>
              ))}
          </SidebarSection>
        ))}
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
