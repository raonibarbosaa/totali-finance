import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v, total) => total ? ((v / total) * 100).toFixed(1) + '%' : '—';

const MONTHS = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function DRE() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [params, setParams]   = useState({ year: currentYear, month: currentMonth, regime: 'CASH' });
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/dre', { params });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao carregar DRE');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [params]);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho e filtros */}
      <div className="flex flex-wrap gap-4 items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">DRE</h1>
          <p className="text-sm text-gray-500 mt-0.5">Demonstração do Resultado do Exercício</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={params.month} onChange={e => set('month', parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
            <option value="">Ano completo</option>
            {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={params.year} onChange={e => set('year', parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {[{ value: 'CASH', label: 'Caixa' }, { value: 'ACCRUAL', label: 'Competência' }].map(r => (
              <button key={r.value} onClick={() => set('regime', r.value)}
                className={`px-4 py-2 text-sm transition-colors ${params.regime === r.value ? 'bg-[#152740] text-white' : 'bg-white text-gray-500'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="px-5 py-2 bg-[#C9A254] text-white text-sm font-medium rounded-xl hover:bg-[#b8913d] disabled:opacity-50">
            {loading ? 'Carregando...' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      {data && (
        <>
          {/* Resultado em destaque */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
              <p className="text-sm text-gray-500">Receita Bruta</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{fmt(data.revenue.total)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm text-gray-500">Lucro Bruto</p>
              <p className={`text-2xl font-bold mt-1 ${data.gross_profit >= 0 ? 'text-[#152740]' : 'text-red-600'}`}>
                {fmt(data.gross_profit)}
              </p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-5 ${data.net_result >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-sm text-gray-500">Resultado Líquido</p>
              <p className={`text-2xl font-bold mt-1 ${data.net_result >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(data.net_result)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.net_result >= 0 ? '✅ Lucro' : '❌ Prejuízo'}</p>
            </div>
          </div>

          {/* Tabela DRE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-semibold text-[#152740]">
                DRE — {params.month ? MONTHS[params.month] : 'Ano'} {params.year}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (Regime de {data.regime === 'CASH' ? 'Caixa' : 'Competência'})
                </span>
              </h2>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {/* Receitas */}
                <DreSection title="RECEITAS" total={data.revenue.total} totalGross={data.revenue.total} accent="green">
                  {data.revenue.breakdown.map((item, i) => (
                    <DreRow key={i} label={item.name} value={item.value} total={data.revenue.total} />
                  ))}
                </DreSection>

                {/* CMV */}
                <DreSeparator label="( - ) Custo das Mercadorias Vendidas (CMV)" value={data.cmv.total} negative />
                <tr className="bg-gray-50/50">
                  <td className="px-10 py-2 text-gray-500 text-xs">Estoque Inicial</td>
                  <td className="px-5 py-2 text-right text-gray-500 text-xs">{fmt(data.cmv.initial_stock)}</td>
                  <td className="px-5 py-2 text-right text-gray-400 text-xs"></td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="px-10 py-2 text-gray-500 text-xs">( + ) Compras de Mercadorias</td>
                  <td className="px-5 py-2 text-right text-gray-500 text-xs">{fmt(data.cmv.purchases)}</td>
                  <td></td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="px-10 py-2 text-gray-500 text-xs">( - ) Estoque Final</td>
                  <td className="px-5 py-2 text-right text-gray-500 text-xs">{fmt(data.cmv.final_stock)}</td>
                  <td></td>
                </tr>

                {/* Lucro Bruto */}
                <DreTotalRow label="LUCRO BRUTO" value={data.gross_profit} highlight />

                {/* Despesas Operacionais */}
                <DreSection title="DESPESAS OPERACIONAIS" total={data.operating_expenses.total} totalGross={data.revenue.total} accent="red">
                  {data.operating_expenses.breakdown.map((item, i) => (
                    <DreRow key={i} label={item.name} value={item.value} total={data.revenue.total} negative />
                  ))}
                </DreSection>

                {/* Resultado Líquido */}
                <DreTotalRow label="RESULTADO LÍQUIDO" value={data.net_result} highlight final />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DreSection({ title, total, totalGross, accent, children }) {
  return (
    <>
      <tr className={`border-t-2 ${accent === 'green' ? 'border-green-200 bg-green-50/40' : 'border-red-100 bg-red-50/30'}`}>
        <td className="px-6 py-3 font-semibold text-[#152740] uppercase text-xs tracking-wide">{title}</td>
        <td className="px-5 py-3 text-right font-bold text-[#152740]">{fmt(total)}</td>
        <td className="px-5 py-3 text-right text-xs text-gray-400">{pct(total, totalGross)}</td>
      </tr>
      {children}
    </>
  );
}

function DreRow({ label, value, total, negative }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="px-10 py-2.5 text-gray-600">{label}</td>
      <td className={`px-5 py-2.5 text-right font-medium ${negative ? 'text-red-500' : 'text-green-600'}`}>
        {negative ? '- ' : ''}{fmt(value)}
      </td>
      <td className="px-5 py-2.5 text-right text-xs text-gray-400">{pct(value, total)}</td>
    </tr>
  );
}

function DreSeparator({ label, value, negative }) {
  return (
    <tr className="border-t border-gray-200 bg-gray-50">
      <td className="px-6 py-2.5 font-medium text-gray-700">{label}</td>
      <td className={`px-5 py-2.5 text-right font-bold ${negative ? 'text-red-500' : 'text-green-600'}`}>
        {negative ? '- ' : ''}{fmt(value)}
      </td>
      <td></td>
    </tr>
  );
}

function DreTotalRow({ label, value, highlight, final }) {
  return (
    <tr className={`border-t-2 ${final ? 'border-[#152740]' : 'border-gray-300'} ${highlight ? (value >= 0 ? 'bg-green-50' : 'bg-red-50') : ''}`}>
      <td className="px-6 py-3 font-bold text-[#152740] uppercase text-sm tracking-wide">{label}</td>
      <td className={`px-5 py-3 text-right font-bold text-lg ${value >= 0 ? 'text-green-700' : 'text-red-600'}`}>
        {fmt(value)}
      </td>
      <td></td>
    </tr>
  );
}
