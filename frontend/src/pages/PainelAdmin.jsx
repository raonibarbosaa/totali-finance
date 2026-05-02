import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const MONTHS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('pt-BR') : 'Nunca';

export default function PainelAdmin() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/dashboard');
      setData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = data?.clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj?.includes(search);
    const matchFilter = filter === 'all'
      ? true
      : filter === 'closed'   ? c.period_closed
      : filter === 'open'     ? !c.period_closed
      : filter === 'overdue'  ? c.overdue_count > 0
      : filter === 'ofx'      ? c.ofx_pending  > 0
      : true;
    return matchSearch && matchFilter;
  }) || [];

  if (loading) return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#152740] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p>Carregando painel...</p>
      </div>
    </div>
  );

  const { summary } = data || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Painel Totali</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão consolidada de todos os clientes</p>
        </div>
        <button onClick={load} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
          ↻ Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total de Clientes" value={summary.totalTenants} color="blue" icon="🏢" />
          <SummaryCard label={`Fechados ${MONTHS[new Date().getMonth()+1]}`} value={summary.closedCount} color="green" icon="🔒"
            sub={`${summary.totalTenants - summary.closedCount} em aberto`} />
          <SummaryCard label="Com Títulos Vencidos" value={summary.withOverdue} color="red" icon="⚠️" />
          <SummaryCard label="OFX Pendentes" value={summary.withOFXPending} color="amber" icon="📂" />
        </div>
      )}

      {/* Filtros e busca */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#152740]/20"
          />
          <div className="flex gap-1 flex-wrap">
            {[
              { value: 'all',    label: 'Todos' },
              { value: 'open',   label: '🔓 Em Aberto' },
              { value: 'closed', label: '🔒 Fechados' },
              { value: 'overdue',label: '⚠️ Com Vencidos' },
              { value: 'ofx',    label: '📂 OFX Pendente' },
            ].map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? 'bg-[#152740] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} cliente(s)</span>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Cliente</th>
              <th className="text-center px-3 py-3 text-gray-500 font-medium">Competência</th>
              <th className="text-center px-3 py-3 text-gray-500 font-medium">Vencidos</th>
              <th className="text-center px-3 py-3 text-gray-500 font-medium">OFX Pendentes</th>
              <th className="text-left px-3 py-3 text-gray-500 font-medium">Última Exportação</th>
              <th className="text-left px-3 py-3 text-gray-500 font-medium">Último Acesso</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Nenhum cliente encontrado</td></tr>
            ) : filtered.map(client => (
              <tr key={client.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelected(client)}>
                <td className="px-6 py-3">
                  <div className="font-medium text-[#152740]">{client.name}</div>
                  {client.cnpj && <div className="text-xs text-gray-400">{client.cnpj}</div>}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    client.period_closed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {client.period_closed ? '🔒' : '🔓'} {MONTHS[client.period_month]}/{client.period_year}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {client.overdue_count > 0
                    ? <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">{client.overdue_count}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {client.ofx_pending > 0
                    ? <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-full font-medium">{client.ofx_pending}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs">{fmtDate(client.last_export)}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{fmtDateTime(client.last_login)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/admin/clientes/${client.id}`); }}
                    className="px-3 py-1.5 text-xs bg-[#152740] text-white rounded-lg hover:bg-[#1e3a5f]">
                    Ver detalhe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer de detalhe rápido */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm bg-white shadow-2xl h-full overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#152740] truncate">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {selected.cnpj && <p className="text-gray-500">CNPJ: {selected.cnpj}</p>}
              <p className="text-gray-500">Usuários vinculados: {selected.user_count}</p>
              <p className="text-gray-500">Último acesso: {fmtDateTime(selected.last_login)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl text-center ${selected.period_closed ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="text-xl">{selected.period_closed ? '🔒' : '🔓'}</div>
                <p className="text-xs mt-1 font-medium text-gray-600">
                  {selected.period_closed ? 'Fechado' : 'Em Aberto'}
                </p>
                <p className="text-xs text-gray-400">{MONTHS[selected.period_month]}/{selected.period_year}</p>
              </div>
              <div className={`p-3 rounded-xl text-center ${selected.overdue_count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="text-xl">{selected.overdue_count > 0 ? '⚠️' : '✅'}</div>
                <p className="text-xs mt-1 font-medium text-gray-600">{selected.overdue_count} vencido(s)</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Última exportação</p>
              <p className="text-sm text-[#152740]">{fmtDate(selected.last_export)}</p>
            </div>
            <button
              onClick={() => navigate(`/admin/clientes/${selected.id}`)}
              className="w-full py-2.5 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f]">
              Abrir Detalhe Completo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, icon, sub }) {
  const colors = {
    blue:  'border-blue-100',
    green: 'border-green-100',
    red:   'border-red-100',
    amber: 'border-amber-100',
  };
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-[#152740] mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}
