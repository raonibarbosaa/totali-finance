import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2,
  TrendingUp, TrendingDown, ArrowLeftRight,
  CheckCircle2, Clock, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import TransactionModal from '../../components/ui/TransactionModal';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { useBankAccounts, useCategories } from '../../hooks/useFinanceData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const TIPO_CONFIG = {
  receita:       { label: 'Receita',       cor: 'text-emerald-600', bg: 'bg-emerald-50',  icon: TrendingUp },
  despesa:       { label: 'Despesa',        cor: 'text-red-500',     bg: 'bg-red-50',      icon: TrendingDown },
  transferencia: { label: 'Transferência',  cor: 'text-blue-600',    bg: 'bg-blue-50',     icon: ArrowLeftRight },
};

const STATUS_CONFIG = {
  realizado:  { label: 'Realizado',   cor: 'bg-emerald-100 text-emerald-700' },
  conciliado: { label: 'Conciliado',  cor: 'bg-navy-100 text-navy-700' },
  previsto:   { label: 'Previsto',    cor: 'bg-amber-100 text-amber-700' },
};

// Primeiro e último dia do mês atual
function mesAtual() {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    inicio: ini.toISOString().substring(0, 10),
    fim:    fim.toISOString().substring(0, 10),
  };
}

export default function Lancamentos() {
  const { contas }    = useBankAccounts();
  const { categorias }= useCategories();

  const [lancamentos, setLancamentos] = useState([]);
  const [totais, setTotais]           = useState({ receitas: 0, despesas: 0 });
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);

  const LIMIT = 50;
  const periodo = mesAtual();

  const [filtros, setFiltros] = useState({
    dataInicio:    periodo.inicio,
    dataFim:       periodo.fim,
    tipo:          '',
    bankAccountId: '',
    categoryId:    '',
    search:        '',
  });

  const [showFiltros, setShowFiltros] = useState(false);
  const [modalLanc, setModalLanc]     = useState(false);
  const [editando, setEditando]       = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });

      const { data } = await api.get(`/transactions?${params}`);
      const items = data.data?.data || data.data?.transactions || [];
      setLancamentos(items);
      setTotal(data.data.total || 0);

      // Totais do período filtrado
      const rec  = items.filter(t => t.tipo === 'receita' && t.status !== 'previsto').reduce((a, t) => a + Number(t.valor), 0);
      const desp = items.filter(t => t.tipo === 'despesa' && t.status !== 'previsto').reduce((a, t) => a + Number(t.valor), 0);
      setTotais({ receitas: rec, despesas: desp });
    } catch (_) {}
    setLoading(false);
  }, [filtros, page]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(id) {
    try {
      await api.delete(`/transactions/${id}`);
      setConfirmDel(null);
      carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.');
    }
  }

  function abrirEdicao(t) {
    setEditando(t);
    setModalLanc(true);
  }

  function fecharModal() {
    setModalLanc(false);
    setEditando(null);
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Lançamentos</h2>
          <p className="text-sm text-slate-400">
            {total} lançamento{total !== 1 ? 's' : ''} no período
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`btn-secondary flex items-center gap-2 ${showFiltros ? 'bg-navy-50 border-navy-200' : ''}`}
          >
            <Filter size={14} /> Filtros
          </button>
          <button
            onClick={() => { setEditando(null); setModalLanc(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={15} /> Novo lançamento
          </button>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Receitas',   value: totais.receitas,             cor: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Despesas',   value: totais.despesas,             cor: 'text-red-500',     bg: 'bg-red-50' },
          { label: 'Resultado',  value: totais.receitas - totais.despesas,
            cor: (totais.receitas - totais.despesas) >= 0 ? 'text-navy-800' : 'text-red-500',
            bg: 'bg-navy-50' },
        ].map(item => (
          <div key={item.label} className={`card p-4 ${item.bg} border-0`}>
            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
            <p className={`font-display font-semibold text-xl ${item.cor}`}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Painel de filtros */}
      {showFiltros && (
        <div className="card p-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="input-label">Data início</label>
              <input type="date" className="input-field text-xs"
                value={filtros.dataInicio}
                onChange={e => setFiltros({ ...filtros, dataInicio: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Data fim</label>
              <input type="date" className="input-field text-xs"
                value={filtros.dataFim}
                onChange={e => setFiltros({ ...filtros, dataFim: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Tipo</label>
              <select className="input-field text-xs" value={filtros.tipo}
                onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}>
                <option value="">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div>
              <label className="input-label">Conta</label>
              <select className="input-field text-xs" value={filtros.bankAccountId}
                onChange={e => setFiltros({ ...filtros, bankAccountId: e.target.value })}>
                <option value="">Todas</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Categoria</label>
              <select className="input-field text-xs" value={filtros.categoryId}
                onChange={e => setFiltros({ ...filtros, categoryId: e.target.value })}>
                <option value="">Todas</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Buscar</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input-field pl-8 text-xs" placeholder="Descrição..."
                  value={filtros.search}
                  onChange={e => setFiltros({ ...filtros, search: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setFiltros({
                dataInicio: periodo.inicio, dataFim: periodo.fim,
                tipo: '', bankAccountId: '', categoryId: '', search: '',
              })}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Data', 'Descrição', 'Categoria', 'Conta', 'Status', 'Valor', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold
                                         text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6,7].map(j => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-2">
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="Nenhum lançamento encontrado"
                      description="Ajuste os filtros ou crie um novo lançamento."
                      action={
                        <button
                          onClick={() => { setEditando(null); setModalLanc(true); }}
                          className="btn-primary flex items-center gap-2 text-sm"
                        >
                          <Plus size={14} /> Novo lançamento
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                lancamentos.map(t => {
                  const cfg = TIPO_CONFIG[t.tipo] || TIPO_CONFIG.despesa;
                  const Icon = cfg.icon;
                  return (
                    <tr key={t.id}
                      className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(t.dataLancamento)}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-medium text-navy-800 truncate text-sm">
                          {t.descricao || t.complemento || '—'}
                        </p>
                        {t.complemento && t.descricao && (
                          <p className="text-xs text-slate-400 truncate">{t.complemento}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.category ? (
                          <div>
                            <p className="text-xs font-medium text-slate-700">{t.category.nome}</p>
                            <p className="text-[10px] text-slate-400 capitalize">
                              {t.category.natureza}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {t.bankAccount?.nome || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium
                          ${STATUS_CONFIG[t.status]?.cor}`}>
                          {STATUS_CONFIG[t.status]?.label}
                        </span>
                        {t.exportado && (
                          <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600
                                           rounded text-[10px] font-medium">
                            exportado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center
                                          justify-center flex-shrink-0`}>
                            <Icon size={12} className={cfg.cor} />
                          </div>
                          <span className={`font-semibold ${cfg.cor}`}>
                            {formatCurrency(t.valor)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirEdicao(t)}
                            className="p-1.5 text-slate-400 hover:text-navy-700
                                       hover:bg-navy-50 rounded transition-colors"
                            title="Editar">
                            <Edit2 size={13} />
                          </button>
                          {t.origem === 'manual' && !t.exportado && (
                            <button onClick={() => setConfirmDel(t)}
                              className="p-1.5 text-slate-400 hover:text-red-600
                                         hover:bg-red-50 rounded transition-colors"
                              title="Excluir">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {total} registros · página {page} de {pages}
            </p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs rounded border border-slate-200
                           disabled:opacity-40 hover:bg-slate-50">
                Anterior
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs rounded border border-slate-200
                           disabled:opacity-40 hover:bg-slate-50">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal lançamento */}
      <TransactionModal
        open={modalLanc}
        onClose={fecharModal}
        onSaved={carregar}
        editando={editando}
      />

      {/* Modal confirmar exclusão */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Excluir lançamento" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Deseja excluir o lançamento{' '}
            <strong>{confirmDel?.descricao || formatCurrency(confirmDel?.valor)}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={() => excluir(confirmDel.id)} className="btn-danger flex-1">
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
