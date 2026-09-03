import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Search, LogOut, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { formatCNPJ, nomeRole } from '../utils/formatters';

export default function SelecionarEmpresa() {
  const navigate = useNavigate();
  const { user, empresas, setTenant, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(null); // id da empresa sendo selecionada
  const [erro, setErro] = useState('');
  const [autoEntrando, setAutoEntrando] = useState(false);
  const jaAutoSelecionou = useRef(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user]);

  // Empresa única: entra direto, sem obrigar um clique numa tela de uma opção só.
  // O ref garante que isso rode uma vez — se a seleção falhar, cai na lista.
  useEffect(() => {
    if (jaAutoSelecionou.current || empresas.length !== 1) return;
    jaAutoSelecionou.current = true;
    setAutoEntrando(true);
    selecionarEmpresa(empresas[0]).finally(() => setAutoEntrando(false));
  }, [empresas]);

  const empresasFiltradas = empresas.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.razaoSocial?.toLowerCase().includes(q) ||
      e.nomeFantasia?.toLowerCase().includes(q) ||
      e.cnpj?.includes(q)
    );
  });

  async function selecionarEmpresa(empresa) {
    setErro('');
    setLoading(empresa.id);

    try {
      // Primeiro emite token básico (sem tenantId) para a chamada
      // O access token ainda não existe aqui, mas o cookie de refresh está presente
      const { data } = await api.post(
        '/auth/selecionar-empresa',
        { tenantId: empresa.id },
        {
          headers: {
            // Usamos o token de sessão temporário guardado no store
            // Se não houver token (primeiro login), a rota funciona pelo cookie
          },
        }
      );

      if (data.success) {
        setTenant(
          data.data.tenant,
          data.data.role,
          data.data.accessToken
        );
        navigate('/app/dashboard');
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao selecionar empresa.');
    } finally {
      setLoading(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Enquanto entra sozinho na empresa única, mostra um aguarde em vez de
  // piscar uma lista com um item só na tela.
  if (autoEntrando && !erro) {
    const unica = empresas[0];
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <span className="w-7 h-7 border-2 border-navy-200 border-t-navy-800
                         rounded-full animate-spin" />
        <p className="text-sm text-slate-500">
          Entrando em {unica?.nomeFantasia || unica?.razaoSocial}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-navy-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-display font-bold text-sm">T</span>
          </div>
          <div>
            <p className="font-display font-semibold text-white text-sm">TotaliFinance</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user?.nome}</p>
            <p className="text-navy-400 text-xs">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-navy-400 hover:text-white transition-colors p-2
                       hover:bg-navy-700 rounded-lg"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex items-start justify-center p-8">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="mb-6">
            <h2 className="font-display font-semibold text-navy-800 text-2xl">
              Selecionar empresa
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {empresas.length === 0
                ? 'Nenhuma empresa vinculada ao seu usuário.'
                : `${empresas.length} empresa${empresas.length !== 1 ? 's' : ''} disponível${empresas.length !== 1 ? 'is' : ''}`}
            </p>
          </div>

          {/* Busca */}
          {empresas.length > 4 && (
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input-field pl-9"
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                            px-4 py-3 rounded-lg mb-4">
              {erro}
            </div>
          )}

          {/* Lista de empresas */}
          <div className="space-y-2">
            {empresasFiltradas.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma empresa encontrada.</p>
              </div>
            )}

            {empresasFiltradas.map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => selecionarEmpresa(empresa)}
                disabled={loading === empresa.id}
                className="w-full card p-4 flex items-center gap-4 text-left
                           hover:border-navy-200 hover:shadow-md transition-all duration-150
                           active:scale-[0.99] disabled:opacity-70"
              >
                {/* Ícone */}
                <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center
                                justify-center flex-shrink-0">
                  {empresa.acesso === 'total' ? (
                    <ShieldCheck size={18} className="text-navy-700" />
                  ) : (
                    <Building2 size={18} className="text-navy-700" />
                  )}
                </div>

                {/* Dados */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-800 text-sm truncate">
                    {empresa.nomeFantasia || empresa.razaoSocial}
                  </p>
                  {empresa.nomeFantasia && (
                    <p className="text-xs text-slate-500 truncate">{empresa.razaoSocial}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{formatCNPJ(empresa.cnpj)}</p>
                </div>

                {/* Nível */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {empresa.acesso === 'total' ? (
                    <span className="badge-role-1">Admin Total</span>
                  ) : (
                    <span className={`badge-role-${empresa.role}`}>
                      {nomeRole(empresa.role)}
                    </span>
                  )}

                  {loading === empresa.id ? (
                    <span className="w-4 h-4 border-2 border-navy-300 border-t-navy-700
                                     rounded-full animate-spin" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
