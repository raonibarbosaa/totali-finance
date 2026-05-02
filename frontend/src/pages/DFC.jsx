import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function DFC() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [params, setParams]   = useState({ year: currentYear, month: currentMonth });
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState({ operational: true, investing: false, financing: false });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/dfc', { params });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao carregar DFC');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [params]);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const toggle = (k) => setExpanded(e => ({ ...e, [k]: !e[k] }));

  const sections = data ? [
    { key: 'operational', label: 'Atividades Operacionais', data: data.operational, color: 'blue' },
    { key: 'investing',   label: 'Atividades de Investimento', data: data.investing, color: 'purple' },
    { key: 'financing',   label: 'Atividades de Financiamento', data: data.financing, color: 'orange' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap gap-4 items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">DFC</h1>
          <p className="text-sm text-gray-500 mt-0.5">Demonstração do Fluxo de Caixa</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={params.month} onChange={e => set('month', parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
            <option value="">Ano completo</option>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={params.year} onChange={e => set('year', parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          <button onClick={load} disabled={loading}
            className="px-5 py-2 bg-[#C9A254] text-white text-sm font-medium rounded-xl hover:bg-[#b8913d] disabled:opacity-50">
            {loading ? 'Carregando...' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      {data && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
              <p className="text-sm text-gray-500">Total Entradas</p>
              <p className="text-xl font-bold text-green-600 mt-1">{fmt(data.total_inflow)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <p className="text-sm text-gray-500">Total Saídas</p>
              <p className="text-xl font-bold text-red-500 mt-1">{fmt(data.total_outflow)}</p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-5 col-span-2 ${data.net_cash_flow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-sm text-gray-500">Fluxo Líquido do Período</p>
              <p className={`text-2xl font-bold mt-1 ${data.net_cash_flow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(data.net_cash_flow)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{data.net_cash_flow >= 0 ? '✅ Geração de caixa' : '⚠️ Consumo de caixa'}</p>
            </div>
          </div>

          {/* Seções por tipo */}
          {sections.map(({ key, label, data: sData, color }) => (
            <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${color === 'blue' ? 'bg-blue-500' : color === 'purple' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                  <h2 className="text-base font-semibold text-[#152740]">{label}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm text-green-600 font-medium mr-4">+ {fmt(sData.inflow)}</span>
                    <span className="text-sm text-red-500 font-medium mr-4">- {fmt(sData.outflow)}</span>
                    <span className={`text-sm font-bold ${sData.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      = {fmt(sData.net)}
                    </span>
                  </div>
                  <span className="text-gray-400">{expanded[key] ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded[key] && sData.items.length > 0 && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-6 py-2.5 text-gray-500 font-medium">Data</th>
                        <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Descrição</th>
                        <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Categoria</th>
                        <th className="text-right px-5 py-2.5 text-gray-500 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sData.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-6 py-2.5 text-gray-500">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-2.5 text-[#152740]">{item.description}</td>
                          <td className="px-3 py-2.5 text-gray-400">{item.category || '—'}</td>
                          <td className={`px-5 py-2.5 text-right font-medium ${item.type === 'in' ? 'text-green-600' : 'text-red-500'}`}>
                            {item.type === 'in' ? '+' : '-'} {fmt(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {expanded[key] && sData.items.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-400 border-t border-gray-100">
                  Nenhuma movimentação nesta categoria no período
                </div>
              )}
            </div>
          ))}

          {/* Saldo por conta */}
          {data.balance_by_account.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-[#152740]">Fluxo por Conta Bancária</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Conta</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Entradas</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Saídas</th>
                    <th className="text-right px-5 py-3 text-gray-500 font-medium">Saldo Período</th>
                  </tr>
                </thead>
                <tbody>
                  {data.balance_by_account.map((acc, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-[#152740]">{acc.account}</td>
                      <td className="px-5 py-3 text-right text-green-600">{fmt(acc.inflow)}</td>
                      <td className="px-5 py-3 text-right text-red-500">{fmt(acc.outflow)}</td>
                      <td className={`px-5 py-3 text-right font-bold ${acc.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmt(acc.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
