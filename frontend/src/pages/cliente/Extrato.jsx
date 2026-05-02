import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, TrendingUp, TrendingDown, Landmark,
  Download, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { useBankAccounts } from '../../hooks/useFinanceData';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';

const TIPO_CONFIG = {
  receita:       { label: 'Receita',      sinal: '+', cor: 'text-emerald-600' },
  despesa:       { label: 'Despesa',      sinal: '-', cor: 'text-red-500'     },
  transferencia: { label: 'Transferência',sinal: '⇄', cor: 'text-blue-600'   },
};

function mesAnoAtual() {
  const now = new Date();
  return { mes: now.getMonth() + 1, ano: now.getFullYear() };
}

function primeiroDia(mes, ano) {
  return new Date(ano, mes - 1, 1).toISOString().substring(0, 10);
}

function ultimoDia(mes, ano) {
  return new Date(ano, mes, 0).toISOString().substring(0, 10);
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Extrato() {
  const { contas, loading: loadingContas } = useBankAccounts();
  const { mes: mesAtual, ano: anoAtual }   = mesAnoAtual();

  const [contaSelecionada, setContaSelecionada] = useState('');
  const [mes, setMes]   = useState(mesAtual);
  const [ano, setAno]   = useState(anoAtual);
  const [dados, setDados]   = useState(null);
  const [loading, setLoading] = useState(false);

  // Seleciona a primeira conta automaticamente
  useEffect(() => {
    if (contas.length > 0 && !contaSelecionada) {
      setContaSelecionada(contas[0].id);
    }
  }, [contas]);

  const carregar = useCallback(async () => {
    if (!contaSelecionada) return;
    setLoading(true);
    try {
      const { data } = await api.get('/transactions/extrato', {
        params: {
          bankAccountId: contaSelecionada,
          dataInicio: primeiroDia(mes, ano),
          dataFim:    ultimoDia(mes, ano),
        },
      });
      setDados(data.data);
    } catch (_) {}
    setLoading(false);
  }, [contaSelecionada, mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  function navMes(dir) {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1;  novoAno++; }
    if (novoMes < 1)  { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  }

  function exportarCSV() {
    if (!dados?.lancamentos?.length) return;
    const header = 'Data,Descrição,Tipo,Categoria,Valor,Saldo\n';
    const rows = dados.lancamentos.map(l =>
      `${formatDate(l.dataLancamento)},"${l.descricao || l.complemento || ''}",${l.tipo},"${l.category?.nome || ''}",${l.tipo === 'receita' ? '' : '-'}${l.valor},${l.saldo}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `extrato_${MESES[mes - 1]}_${ano}.csv`;
    a.click();
  }

  const contaAtual = contas.find(c => c.id === contaSelecionada);

  return (
    <div className="space-y-4">

      {/* Seletor de conta e período */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Conta */}
          <div className="flex items-center gap-2">
            <Landmark size={15} className="text-navy-600" />
            <select
              className="input-field w-56 text-sm"
              value={contaSelecionada}
              onChange={e => setContaSelecionada(e.target.value)}
            >
              {loadingContas
                ? <option>Carregando...</option>
                : contas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))
              }
            </select>
          </div>

          {/* Navegador de mês */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => navMes(-1)}
              className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-white
                         rounded-md transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 text-sm font-medium text-navy-800 min-w-[140px] text-center">
              {MESES[mes - 1]} {ano}
            </span>
            <button onClick={() => navMes(1)}
              disabled={mes === mesAtual && ano === anoAtual}
              className="p-1.5 text-slate-500 hover:text-navy-800 hover:bg-white
                         rounded-md transition-colors disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex-1" />

          <button onClick={exportarCSV}
            disabled={!dados?.lancamentos?.length}
            className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-40">
            <Download size={13} /> Exportar CSV
          </button>
          <button onClick={carregar}
            className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Saldo anterior',
              value: dados.saldoAnterior,
              cor: 'text-navy-700',
              bg: 'bg-navy-50',
            },
            {
              label: 'Total receitas',
              value: dados.totalReceitas,
              cor: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: 'Total despesas',
              value: dados.totalDespesas,
              cor: 'text-red-500',
              bg: 'bg-red-50',
            },
            {
              label: 'Saldo final',
              value: dados.saldoFinal,
              cor: dados.saldoFinal >= 0 ? 'text-navy-800' : 'text-red-600',
              bg: dados.saldoFinal >= 0 ? 'bg-white' : 'bg-red-50',
            },
          ].map(item => (
            <div key={item.label} className={`card p-4 ${item.bg} border-0`}>
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className={`font-display font-semibold text-lg ${item.cor}`}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de extrato */}
      <div className="card overflow-hidden">
        {/* Info da conta */}
        {contaAtual && (
          <div className="px-5 py-3 bg-navy-800 flex items-center gap-3">
            <Landmark size={15} className="text-navy-300" />
            <div>
              <p className="text-white text-sm font-medium">{contaAtual.nome}</p>
              <p className="text-navy-400 text-xs">
                {contaAtual.banco && `${contaAtual.banco} · `}
                {contaAtual.agencia && `Ag. ${contaAtual.agencia} · `}
                {contaAtual.conta && `Cta. ${contaAtual.conta}`}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Saldo'].map(h => (
                  <th key={h}
                    className={`px-5 py-3 text-xs font-semibold text-slate-500
                                uppercase tracking-wide
                                ${['Valor', 'Saldo'].includes(h) ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">

              {/* Linha de saldo anterior */}
              {dados && (
                <tr className="bg-slate-50">
                  <td colSpan={4} className="px-5 py-2.5 text-xs text-slate-500 font-medium">
                    Saldo anterior ao período
                  </td>
                  <td />
                  <td className="px-5 py-2.5 text-right">
                    <span className={`font-semibold text-sm ${
                      dados.saldoAnterior >= 0 ? 'text-navy-700' : 'text-red-500'
                    }`}>
                      {formatCurrency(dados.saldoAnterior)}
                    </span>
                  </td>
                </tr>
              )}

              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !dados || dados.lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-2">
                    <EmptyState
                      icon={BookOpen}
                      title="Nenhum lançamento neste período"
                      description="Não há movimentações registradas para esta conta no período selecionado."
                    />
                  </td>
                </tr>
              ) : (
                dados.lancamentos.map(l => {
                  const cfg = TIPO_CONFIG[l.tipo] || TIPO_CONFIG.despesa;
                  return (
                    <tr key={l.id}
                      className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(l.dataLancamento)}
                      </td>
                      <td className="px-5 py-3 max-w-[200px]">
                        <p className="font-medium text-navy-800 truncate text-sm">
                          {l.descricao || l.complemento || '—'}
                        </p>
                        {l.complemento && l.descricao && (
                          <p className="text-xs text-slate-400 truncate">{l.complemento}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {l.category?.nome || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium text-slate-600">
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold ${cfg.cor}`}>
                          {cfg.sinal} {formatCurrency(l.valor)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold text-sm ${
                          l.saldo >= 0 ? 'text-navy-800' : 'text-red-500'
                        }`}>
                          {formatCurrency(l.saldo)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Linha de saldo final */}
              {dados && dados.lancamentos.length > 0 && (
                <tr className="bg-navy-50 border-t-2 border-navy-100">
                  <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-navy-800">
                    Saldo final do período
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-500">
                    <span className="text-emerald-600">+{formatCurrency(dados.totalReceitas)}</span>
                    {' / '}
                    <span className="text-red-500">-{formatCurrency(dados.totalDespesas)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-display font-bold text-lg ${
                      dados.saldoFinal >= 0 ? 'text-navy-800' : 'text-red-600'
                    }`}>
                      {formatCurrency(dados.saldoFinal)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
