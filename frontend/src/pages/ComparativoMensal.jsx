import { useState, useEffect } from 'react';
import api from '../services/api';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min((Math.abs(value) / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ComparativoMensal() {
  const [year, setYear]   = useState(new Date().getFullYear());
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/monthly-comparison', { params: { year } });
      setData(res.data.data?.meses || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year]);

  const maxIncome  = Math.max(...data.map(d => d.income),  1);
  const maxExpense = Math.max(...data.map(d => d.expense), 1);
  const maxAbs     = Math.max(maxIncome, maxExpense);

  const totalIncome  = data.reduce((s, d) => s + d.income,  0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const totalResult  = totalIncome - totalExpense;

  const bestMonth  = [...data].sort((a, b) => b.result - a.result)[0];
  const worstMonth = [...data].sort((a, b) => a.result - b.result)[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Comparativo Mensal</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receitas, despesas e resultado mês a mês</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">‹</button>
          <span className="text-lg font-bold text-[#152740] w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">›</button>
        </div>
      </div>

      {/* Totais anuais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Total de Receitas {year}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Total de Despesas {year}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{fmt(totalExpense)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-5 ${totalResult >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm text-gray-500">Resultado Anual</p>
          <p className={`text-2xl font-bold mt-1 ${totalResult >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmt(totalResult)}
          </p>
        </div>
      </div>

      {/* Highlights */}
      {data.some(d => d.income > 0 || d.expense > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {bestMonth && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Melhor Mês</p>
              <p className="text-lg font-bold text-[#152740]">{MONTHS[bestMonth.month - 1]}</p>
              <p className={`text-xl font-bold mt-1 ${bestMonth.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(bestMonth.result)}
              </p>
            </div>
          )}
          {worstMonth && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Pior Mês</p>
              <p className="text-lg font-bold text-[#152740]">{MONTHS[worstMonth.month - 1]}</p>
              <p className={`text-xl font-bold mt-1 ${worstMonth.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(worstMonth.result)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Gráfico de barras em SVG puro */}
      {data.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#152740] mb-4">Evolução Mensal</h2>
          <div className="flex items-end gap-1 h-48 overflow-x-auto">
            {data.map((d, i) => {
              const incH  = maxAbs > 0 ? (d.income  / maxAbs) * 160 : 0;
              const expH  = maxAbs > 0 ? (d.expense / maxAbs) * 160 : 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-12">
                  <div className="flex items-end gap-0.5 h-40">
                    <div className="w-4 bg-green-400 rounded-t transition-all hover:opacity-80"
                      style={{ height: `${incH}px` }} title={`Receita: ${fmt(d.income)}`} />
                    <div className="w-4 bg-red-400 rounded-t transition-all hover:opacity-80"
                      style={{ height: `${expH}px` }} title={`Despesa: ${fmt(d.expense)}`} />
                  </div>
                  <div className={`w-8 h-1.5 rounded-full ${d.result >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-400">{MONTHS[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block"/>Receitas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/>Despesas</span>
            <span className="flex items-center gap-1"><span className="w-5 h-1.5 rounded-full bg-green-500 inline-block"/>Resultado +</span>
            <span className="flex items-center gap-1"><span className="w-5 h-1.5 rounded-full bg-red-500 inline-block"/>Resultado -</span>
          </div>
        </div>
      )}

      {/* Tabela detalhada */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#152740]">Detalhe por Mês</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Mês</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Receitas</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Despesas</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Resultado</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const isCurrentMonth = d.month === new Date().getMonth() + 1 && year === new Date().getFullYear();
                return (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isCurrentMonth ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-3 font-medium text-[#152740]">
                      {MONTHS[i]}
                      {isCurrentMonth && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">atual</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-green-600 font-medium">{fmt(d.income)}</td>
                    <td className="px-5 py-3 text-right text-red-500 font-medium">{fmt(d.expense)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${d.result >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(d.result)}
                    </td>
                    <td className="px-5 py-3 w-32">
                      <Bar value={d.income}  max={maxAbs} color="bg-green-400" />
                      <Bar value={d.expense} max={maxAbs} color="bg-red-400" />
                    </td>
                  </tr>
                );
              })}
              {/* Totais */}
              <tr className="border-t-2 border-[#152740] bg-gray-50 font-bold">
                <td className="px-6 py-3 text-[#152740] uppercase text-xs tracking-wide">TOTAL {year}</td>
                <td className="px-5 py-3 text-right text-green-700">{fmt(totalIncome)}</td>
                <td className="px-5 py-3 text-right text-red-600">{fmt(totalExpense)}</td>
                <td className={`px-5 py-3 text-right ${totalResult >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(totalResult)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
