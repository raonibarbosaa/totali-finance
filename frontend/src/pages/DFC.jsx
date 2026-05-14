import { useEffect, useState } from 'react';
import api from '../services/api';

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);
const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_SHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const GRUPO_COR = {
  OPERACIONAL:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700'   },
  INVESTIMENTO:  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
  FINANCIAMENTO: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-100 text-amber-700'  },
};

function GrupoDFC({ grupo }) {
  const [aberto, setAberto] = useState(false);
  const cor = GRUPO_COR[grupo.tipo] || GRUPO_COR.OPERACIONAL;

  return (
    <div className={`rounded-xl border ${cor.border} overflow-hidden mb-4`}>
      {/* Header */}
      <button
        onClick={() => setAberto(a => !a)}
        className={`w-full flex items-center justify-between px-5 py-4 ${cor.bg} transition-colors hover:brightness-95`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs ${aberto ? 'rotate-90' : ''} transition-transform inline-block`}>▶</span>
          <span className={`font-semibold text-sm ${cor.text}`}>{grupo.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cor.badge}`}>
            {grupo.itens.length} lançamento{grupo.itens.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <span className="text-green-700 hidden md:block">+{moeda(grupo.entradas)}</span>
          <span className="text-red-600 hidden md:block">−{moeda(grupo.saidas)}</span>
          <span className={`font-bold text-base ${grupo.liquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {moeda(grupo.liquido)}
          </span>
        </div>
      </button>

      {/* Linha de entrada/saída em mobile */}
      <div className={`flex gap-4 px-5 pb-3 pt-0 md:hidden ${cor.bg} text-xs`}>
        <span className="text-green-700">Entradas: {moeda(grupo.entradas)}</span>
        <span className="text-red-600">Saídas: {moeda(grupo.saidas)}</span>
      </div>

      {/* Detalhamento */}
      {aberto && grupo.itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-t border-gray-200">
                <th className="py-2 pl-5 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                <th className="py-2 pr-5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
              </tr>
            </thead>
            <tbody>
              {grupo.itens.map((item, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pl-5 pr-4 text-gray-500 whitespace-nowrap">{item.data || '—'}</td>
                  <td className="py-2 px-4 text-gray-700 max-w-xs truncate">{item.descricao || '—'}</td>
                  <td className="py-2 px-4 text-gray-500 hidden md:table-cell">{item.categoria}</td>
                  <td className={`py-2 pr-5 text-right font-medium ${item.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                    {item.tipo === 'entrada' ? '+' : '−'}{moeda(Math.abs(item.valor))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aberto && grupo.itens.length === 0 && (
        <p className="px-5 py-3 text-sm text-gray-400 italic border-t border-gray-100">Nenhum lançamento no período.</p>
      )}
    </div>
  );
}

function CardConta({ conta }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-700 truncate mb-3">{conta.nome}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Entradas</span>
          <span className="text-green-600 font-medium">{moeda(conta.entradas)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Saídas</span>
          <span className="text-red-500 font-medium">{moeda(conta.saidas)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
          <span className="text-gray-700 font-medium">Fluxo líquido</span>
          <span className={`font-bold ${conta.liquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moeda(conta.liquido)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DFC() {
  const [ano, setAno]   = useState(String(ANO_ATUAL));
  const [mes, setMes]   = useState('');
  const [dfc, setDfc]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  async function buscar() {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({ year: ano });
      if (mes) params.append('month', mes);
      const res = await api.get(`/reports/dfc?${params}`);
      setDfc(res.data.data);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao carregar DFC.');
    } finally {
      setLoading(false);
    }
  }

  const tituloPeriodo = mes
    ? `${MESES_FULL[parseInt(mes)]} de ${ano}`
    : `Ano ${ano}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">DFC — Demonstração dos Fluxos de Caixa</h1>
        <p className="text-sm text-gray-500 mt-1">Entradas e saídas de recursos financeiros por atividade</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
          <select
            value={ano}
            onChange={e => setAno(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mês (opcional)</label>
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Ano todo</option>
            {MESES_SHORT.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <button
          onClick={buscar}
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Carregando...' : 'Gerar DFC'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{erro}</div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {dfc && !loading && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total Entradas</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{moeda(dfc.totalEntradas)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Total Saídas</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{moeda(dfc.totalSaidas)}</p>
            </div>
            <div className={`rounded-xl px-5 py-4 border-2 ${dfc.fluxoLiquido >= 0 ? 'bg-blue-50 border-blue-300' : 'bg-orange-50 border-orange-300'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${dfc.fluxoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Fluxo Líquido</p>
              <p className={`text-2xl font-bold mt-1 ${dfc.fluxoLiquido >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{moeda(dfc.fluxoLiquido)}</p>
              <p className="text-xs mt-1 text-gray-400">{tituloPeriodo} · {dfc.totalTransacoes} lançamentos</p>
            </div>
          </div>

          {/* Grupos de atividade */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Por Atividade</h2>
            {dfc.grupos.map(grupo => (
              <GrupoDFC key={grupo.tipo} grupo={grupo} />
            ))}
          </div>

          {/* Por conta bancária */}
          {dfc.porConta && dfc.porConta.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Por Conta Bancária</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dfc.porConta.map(conta => (
                  <CardConta key={conta.id} conta={conta} />
                ))}
              </div>
            </div>
          )}

          {/* Nota sobre configuração do dfcType */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">💡 Dica:</span> Por padrão, todas as categorias são classificadas como <em>Operacionais</em>. Para mover uma categoria para Investimento ou Financiamento, edite-a no cadastro de categorias e defina o campo <strong>Tipo DFC</strong>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
