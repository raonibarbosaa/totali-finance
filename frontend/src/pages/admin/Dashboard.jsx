import { useState, useEffect } from 'react';
import {
  Building2, CheckCircle2, Clock, AlertTriangle,
  FileDown, Users, RefreshCw, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { formatDateTime, formatCNPJ } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

function StatusBadge({ status }) {
  if (status === 'fechado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                       font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={11} /> Fechado
      </span>
    );
  }
  if (status === 'atrasado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                       font-medium bg-red-100 text-red-700">
        <AlertTriangle size={11} /> Atrasado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                     font-medium bg-amber-100 text-amber-700">
      <Clock size={11} /> Em aberto
    </span>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [stats, setStats] = useState({ total: 0, fechados: 0, emAberto: 0, atrasados: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [clientesRes, notifsRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/notifications?lida=false&limit=10'),
        ]);
        const data = clientesRes.data.data;
        setClientes(data.clientes || []);
        setStats(data.stats || {});
        setNotificacoes(notifsRes.data.data?.notifications || []);
      } catch (_) {}
      setLoading(false);
    }
    load();
  }, []);

  async function acessarEmpresa(tenantId) {
    try {
      const { data } = await api.post('/auth/selecionar-empresa', { tenantId });
      if (data.success) {
        const { setTenant } = (await import('../../store/authStore')).default.getState();
        setTenant(data.data.tenant, data.data.role, data.data.accessToken);
        navigate('/app/dashboard');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao acessar empresa.');
    }
  }

  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-xl">
          Painel Totali — {mes}
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Visão consolidada de todos os clientes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de clientes', value: stats.total, icon: Building2, color: 'bg-navy-700' },
          { label: 'Competência fechada', value: stats.fechados, icon: CheckCircle2, color: 'bg-emerald-500' },
          { label: 'Em aberto', value: stats.emAberto, icon: Clock, color: 'bg-amber-500' },
          { label: 'Atrasados', value: stats.atrasados, icon: AlertTriangle, color: 'bg-red-500' },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center
                            justify-center mb-3`}>
              <item.icon size={16} className="text-white" />
            </div>
            <p className="text-2xl font-display font-semibold text-navy-800">
              {loading ? '—' : item.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de clientes */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-navy-600" />
              <h3 className="font-display font-semibold text-navy-800 text-sm">
                Status por cliente
              </h3>
            </div>
            <button
              onClick={() => navigate('/admin/clientes')}
              className="text-xs text-navy-600 hover:text-navy-800 font-medium"
            >
              Ver todos →
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-3 bg-slate-100 rounded w-40 mb-1.5" />
                    <div className="h-2.5 bg-slate-100 rounded w-28" />
                  </div>
                </div>
              ))
            ) : clientes.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              clientes.map((c) => (
                <div key={c.id}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50
                             transition-colors">
                  <div className="w-8 h-8 bg-navy-100 rounded-lg flex items-center
                                  justify-center flex-shrink-0">
                    <Building2 size={14} className="text-navy-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-800 truncate">
                      {c.nomeFantasia || c.razaoSocial}
                    </p>
                    <p className="text-xs text-slate-400">{formatCNPJ(c.cnpj)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={c.statusCompetencia} />
                    <button
                      onClick={() => acessarEmpresa(c.id)}
                      className="p-1 text-slate-400 hover:text-navy-700 transition-colors
                                 hover:bg-navy-50 rounded"
                      title="Acessar empresa"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notificações recentes */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <FileDown size={15} className="text-navy-600" />
              <h3 className="font-display font-semibold text-navy-800 text-sm">
                Exportações recentes
              </h3>
            </div>
          </div>
          <div className="card-body py-1 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
              ))
            ) : notificacoes.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <FileDown size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma exportação recente</p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div key={n.id}
                  className="py-2 border-b border-slate-50 last:border-0">
                  <p className="text-xs font-medium text-slate-700">{n.titulo}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDateTime(n.criadoEm)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
