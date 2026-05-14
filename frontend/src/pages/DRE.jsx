import { useEffect, useState } from 'react';
import api from '../services/api';

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - i);

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

function CardResumo({ label, valor, cor, subLabel }) {
  const corMap = {
    verde:    'bg-green-50 border-green-200 text-green-700',
    vermelho: 'bg-red-50 border-red-200 text-red-700',
    azul:     'bg-blue-50 border-blue-200 text-blue-700',
    cinza:    'bg-gray-50 border-gray-200 text-gray-700',
    amarelo:  'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  const classe = corMap[cor] || corMap.cinza;
  return (
    <div className={`rounded-xl border px-5 py-4 ${classe}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{moeda(valor)}</p>
      {subLabel && <p className="text-xs mt-1 opacity-60">{subLabel}</p>}
    </div>
  );
}

function LinhaCategoria({ item, corValor }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2 pl-8 pr-4 text-sm text-gray-600">{item.nome}</td>
      <td className={`py-2 px-4 text-sm font-medium text-right ${corValor}`}>{moeda(item.valor)}</td>
      <td className="py-2 pr-4 text-xs text-gray-400 text-right">{pct(item.percentual)}</td>
    </tr>
  );
}

function SecaoDRE({ titulo, total, itens, corTotal, corItens, bgHeader, defaultOpen = false }) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setAberto(a => !a)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${bgHeader}`}
      >
        <span className="flex items-center gap-2">
          <span className={`text-xs ${aberto ? 'rotate-90' : ''} transition-transform inline-block`}>▶</span>
          {titulo}
        </span>
        <span className={`font-bold text-base ${corTotal}`}>{moeda(total)}</span>
      </button>
      {aberto && itens && itens.length > 0 && (
        <table className="w-full">
          <tbody>
            {itens.map((item, i) => (
              <LinhaCategoria key={i} item={item} corValor={corItens} />
            ))}
          </tbody>
        </table>
      )}
      {aberto && (!itens || itens.length === 0) && (
        <p className="pl-8 py-2 text-sm text-gray-400 italic">Nenhum lançamento no período.</p>
      )}
    </div>
  );
}

function LinhaTotalizadora({ label, valor, destaque = false, separador = false }) {
  return (
    <>
      {separador && <tr><td colSpan={3} className="border-t-2 border-gray-300" /></tr>}
      <tr className={destaque ? 'bg-gray-100' : ''}>
        <td className={`py-3 pl-4 pr-4 text-sm font-bold ${destaque ? 'text-gray-800' : 'text-gray-600'}`}>{label}</td>
        <td className={`py-3 px-4 font-bold text-right text-base ${Number(valor) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moeda(valor)}</td>
        <td className="py-3 pr-4" />
      </tr>
    </>
  );
}

export default function DRE() {
  const [ano, setAno]       = useState(String(ANO_ATUAL));
  const [mes, setMes]       = useState('');
  const [regime, setRegime] = useState('CASH');
  const [dre, setDre]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState('');

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, regime]);

  async function buscar() {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({ year: ano, regime });
      if (mes) params.append('month', mes);
      const res = await api.get(`/reports/dre?${params}`);
      setDre(res.data.data);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao carregar DRE.');
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
        <h1 className="text-2xl font-bold text-gray-800">DRE — Demonstração do Resultado</h1>
        <p className="text-sm text-gray-500 mt-1">Resultado econômico do período selecionado</p>
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
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Regime</label>
          <select
            value={regime}
            onChange={e => setRegime(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="CASH">Caixa</option>
            <option value="COMPETENCIA">Competência</option>
          </select>
        </div>
        <button
          onClick={buscar}
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Carregando...' : 'Gerar DRE'}
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

      {dre && !loading && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <CardResumo label="Receita Bruta"      valor={dre.receita.total}              cor="azul"    subLabel={tituloPeriodo} />
            <CardResumo label="Lucro Bruto"         valor={dre.lucroBruto}                 cor={dre.lucroBruto >= 0 ? 'verde' : 'vermelho'} />
            <CardResumo label="Result. Operacional" valor={dre.resultadoOperacional}       cor={dre.resultadoOperacional >= 0 ? 'verde' : 'vermelho'} />
            <CardResumo label="Resultado Líquido"   valor={dre.resultadoLiquido}           cor={dre.resultadoLiquido >= 0 ? 'verde' : 'vermelho'} subLabel={`${dre.totalTransacoes} lançamentos`} />
          </div>

          {/* Tabela DRE */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Demonstração — {tituloPeriodo} · Regime {regime === 'CASH' ? 'Caixa' : 'Competência'}</h2>
            </div>

            <div className="p-4 space-y-1">
              {/* Receita */}
              <SecaoDRE
                titulo="(+) Receita Bruta"
                total={dre.receita.total}
                itens={dre.receita.itens}
                corTotal="text-green-700"
                corItens="text-green-600"
                bgHeader="bg-green-50 hover:bg-green-100 text-green-800"
                defaultOpen
              />

              {/* CMV (só exibe se houver) */}
              {dre.cmv.total > 0 && (
                <SecaoDRE
                  titulo="(−) Custo das Mercadorias Vendidas (CMV)"
                  total={dre.cmv.total}
                  itens={dre.cmv.itens}
                  corTotal="text-red-600"
                  corItens="text-red-500"
                  bgHeader="bg-red-50 hover:bg-red-100 text-red-800"
                />
              )}

              {/* Lucro Bruto */}
              <div className="flex justify-between items-center px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-sm font-bold text-blue-800">(=) Lucro Bruto</span>
                <span className={`text-base font-bold ${dre.lucroBruto >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{moeda(dre.lucroBruto)}</span>
              </div>

              {/* Despesas Operacionais */}
              <SecaoDRE
                titulo="(−) Despesas Operacionais"
                total={dre.despesasOperacionais.total}
                itens={dre.despesasOperacionais.itens}
                corTotal="text-red-600"
                corItens="text-red-500"
                bgHeader="bg-red-50 hover:bg-red-100 text-red-800"
                defaultOpen
              />

              {/* Resultado Operacional */}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-100 rounded-lg border border-gray-200">
                <span className="text-sm font-bold text-gray-800">(=) Resultado Operacional</span>
                <span className={`text-base font-bold ${dre.resultadoOperacional >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moeda(dre.resultadoOperacional)}</span>
              </div>

              {/* Distribuição de Lucros (só exibe se houver) */}
              {dre.distribuicaoLucros.total > 0 && (
                <>
                  <SecaoDRE
                    titulo="(−) Distribuição de Lucros / Retiradas"
                    total={dre.distribuicaoLucros.total}
                    itens={dre.distribuicaoLucros.itens}
                    corTotal="text-orange-600"
                    corItens="text-orange-500"
                    bgHeader="bg-orange-50 hover:bg-orange-100 text-orange-800"
                  />
                </>
              )}

              {/* Resultado Líquido */}
              <div className={`flex justify-between items-center px-4 py-4 rounded-xl border-2 ${dre.resultadoLiquido >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                <span className={`text-base font-bold ${dre.resultadoLiquido >= 0 ? 'text-green-800' : 'text-red-800'}`}>(=) Resultado Líquido do Período</span>
                <span className={`text-2xl font-extrabold ${dre.resultadoLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moeda(dre.resultadoLiquido)}</span>
              </div>
            </div>
          </div>

          {/* Indicadores */}
          {dre.receita.total > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Indicadores</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Margem Bruta</p>
                  <p className={`text-lg font-bold ${dre.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pct((dre.lucroBruto / dre.receita.total) * 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Margem Operacional</p>
                  <p className={`text-lg font-bold ${dre.resultadoOperacional >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pct((dre.resultadoOperacional / dre.receita.total) * 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Margem Líquida</p>
                  <p className={`text-lg font-bold ${dre.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pct((dre.resultadoLiquido / dre.receita.total) * 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Despesas / Receita</p>
                  <p className="text-lg font-bold text-gray-700">
                    {pct(((dre.despesasOperacionais.total + dre.cmv.total) / dre.receita.total) * 100)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
