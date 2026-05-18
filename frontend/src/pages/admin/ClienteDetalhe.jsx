import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Building2, Lock, Unlock, AlertTriangle, FileText,
  Clock, Calendar, Banknote, Cloud, ExternalLink
} from 'lucide-react';
import api from '../../services/api';

const MONTHS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtDate     = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('pt-BR')     : 'Nunca';
const fmtBRL      = v => Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

function StatCard({ label, value, icon: Icon, color, sublabel }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-[#152740] truncate">{value}</p>
          {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function OfxPendingCard({ count, clientId }) {
  const [show, setShow]       = useState(false);
  const [list, setList]       = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEnter = async () => {
    setShow(true);
    if (list) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/clients/${clientId}/ofx-pending`);
      setList(res.data.data);
    } catch (e) { console.error(e); }
    finally    { setLoading(false); }
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-help hover:border-amber-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">OFX pendentes</p>
            <p className="text-2xl font-semibold text-[#152740] truncate">{count}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">passe o mouse para ver</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${count > 0 ? 'bg-amber-500' : 'bg-slate-400'}`}>
            <Cloud size={18} className="text-white"/>
          </div>
        </div>
      </div>

      {show && count > 0 && (
        <div className="absolute top-full mt-2 right-0 z-50 w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-xs font-semibold text-[#152740] uppercase tracking-wide">Pendências OFX</p>
            {list && <p className="text-[10px] text-gray-400">{list.entries.length} de {list.total}</p>}
          </div>
          {loading && <div className="text-center py-6 text-xs text-gray-400">Carregando...</div>}
          {list && list.entries.map(e => (
            <div key={e.id} className="px-2 py-2 hover:bg-gray-50 rounded-lg border-b border-gray-50 last:border-0">
              <div className="flex justify-between items-start gap-2 mb-0.5">
                <span className="text-xs text-gray-400">{fmtDate(e.data)}</span>
                <span className={`text-xs font-semibold ${e.tipo === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.tipo === 'credit' ? '+ ' : '- '}{fmtBRL(Math.abs(e.valor))}
                </span>
              </div>
              <p className="text-xs text-[#152740] truncate">{e.descricao}</p>
              {e.conta && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Conta {e.conta}</p>}
            </div>
          ))}
          {list && list.total > list.entries.length && (
            <p className="text-[10px] text-center text-gray-400 mt-2 pt-2 border-t border-gray-100">
              + {list.total - list.entries.length} pendência(s) adicional(is)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-[#152740] ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function AdminClienteDetalhe() {
  const navigate    = useNavigate();
  const { id }      = useParams();
  const { state }   = useLocation();
  const [client, setClient]   = useState(state?.client || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res   = await api.get('/admin/dashboard');
        const found = res.data?.data?.clients?.find(c => c.id === id);
        setClient(found || null);
      } catch (e) { console.error(e); }
      finally    { setLoading(false); }
    })();
  }, [id]);

  if (loading && !client) return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#152740] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p>Carregando detalhes...</p>
      </div>
    </div>
  );

  if (!client) return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#152740] mb-4">
        <ArrowLeft size={16}/> Voltar para o painel
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36}/>
        <p className="text-[#152740] font-medium">Cliente não encontrado</p>
      </div>
    </div>
  );

  const periodLabel = `${MONTHS[client.period_month]}/${client.period_year}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate('/admin/dashboard')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#152740] transition-colors">
        <ArrowLeft size={16}/> Voltar para o painel
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#152740] flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className="text-[#C4973A]"/>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[#152740] truncate">{client.name}</h1>
              {client.cnpj && <p className="text-sm text-gray-500 mt-0.5 font-mono">{client.cnpj}</p>}
            </div>
          </div>
          <button onClick={() => navigate('/selecionar-empresa')}
            className="flex items-center gap-2 px-4 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors">
            <ExternalLink size={14}/> Trocar para esta empresa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Competência atual" value={periodLabel}
          sublabel={client.period_closed ? 'Período fechado' : 'Em aberto'}
          icon={client.period_closed ? Lock : Unlock}
          color={client.period_closed ? 'bg-emerald-500' : 'bg-amber-500'} />
        <StatCard label="Títulos vencidos" value={client.overdue_count || 0}
          sublabel={client.overdue_count > 0 ? 'Requer atenção' : 'Em dia'}
          icon={AlertTriangle}
          color={client.overdue_count > 0 ? 'bg-red-500' : 'bg-slate-400'} />
        <OfxPendingCard count={client.ofx_pending || 0} clientId={client.id}/>
        <StatCard label="Último acesso"
          value={client.last_login ? fmtDateTime(client.last_login) : 'Nunca'}
          icon={Clock} color="bg-[#152740]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText size={16} className="text-gray-400"/>
            <h2 className="text-sm font-semibold text-[#152740]">Informações cadastrais</h2>
          </div>
          <div className="px-6 py-2">
            <InfoRow label="Razão Social" value={client.name}/>
            <InfoRow label="CNPJ" value={client.cnpj} mono/>
            <InfoRow label="Usuários vinculados" value={client.user_count ?? '—'}/>
            <InfoRow label="Status" value={<span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">Ativo</span>}/>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={16} className="text-gray-400"/>
            <h2 className="text-sm font-semibold text-[#152740]">Atividade recente</h2>
          </div>
          <div className="px-6 py-2">
            <InfoRow label="Último login" value={fmtDateTime(client.last_login)}/>
            <InfoRow label="Última exportação Domínio" value={fmtDate(client.last_export)}/>
            <InfoRow label="Competência atual" value={periodLabel}/>
            <InfoRow label="Status do período" value={client.period_closed ? '🔒 Fechado' : '🔓 Aberto'}/>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Banknote size={16} className="text-gray-400"/>
          <h2 className="text-sm font-semibold text-[#152740]">Operacional</h2>
        </div>
        <div className="px-6 py-2">
          <InfoRow label="Títulos vencidos a pagar/receber" value={client.overdue_count || 0}/>
          <InfoRow label="OFX importados aguardando conciliação" value={client.ofx_pending || 0}/>
          <InfoRow label="Última exportação para Domínio Contábil" value={fmtDate(client.last_export)}/>
        </div>
      </div>
    </div>
  );
}
