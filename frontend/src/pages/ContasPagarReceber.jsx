import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import TituloModal from '../components/TituloModal';
import BaixaModal from '../components/BaixaModal';
import ImportarXMLModal from '../components/ImportarXMLModal';

const STATUS_STYLE = {
  aberto:    { label: 'Em Aberto',  cls: 'bg-blue-100 text-blue-700' },
  parcial:   { label: 'Parcial',    cls: 'bg-amber-100 text-amber-700' },
  pago:      { label: 'Pago',       cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
};

const fmt     = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function isOverdue(t) {
  if (t.status !== 'aberto' && t.status !== 'parcial') return false;
  return new Date(t.dataVencimento) < new Date();
}

export default function ContasPagarReceber() {
  const location  = useLocation();
  const isPagar   = location.pathname.includes('contas-pagar');
  const tipo      = isPagar ? 'pagar' : 'receber';

  const [titles, setTitles]         = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState({ status: 'aberto', search: '', dateFrom: '', dateTo: '' });
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal]           = useState({ open: false, titulo: null });
  const [baixaModal, setBaixaModal] = useState({ open: false, titulo: null });
  const [xmlModal, setXmlModal]     = useState(false);
  const [xmlMsg, setXmlMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tipo, page, limit: 50, ...filters };
      const [listRes, sumRes] = await Promise.all([
        api.get('/titles', { params }),
        api.get('/titles/summary'),
      ]);
      setTitles(listRes.data.data?.data || []);
      setTotalPages(listRes.data.data?.totalPages || 1);
      setSummary(sumRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tipo, filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este título?')) return;
    try { await api.delete(`/titles/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Erro'); }
  };

  const handleCancelar = async (id) => {
    if (!confirm('Cancelar este título?')) return;
    try { await api.post(`/titles/${id}/cancelar`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Erro'); }
  };

  const handleXmlImported = (count) => {
    setXmlMsg(`✅ ${count} título(s) importado(s) com sucesso!`);
    load();
    setTimeout(() => setXmlMsg(''), 5000);
  };

  const current = summary?.[isPagar ? 'pagar' : 'receber'];

  return (
    <div className="p-6 space-y-6">

      {/* Tabs Pagar / Receber */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            { path: '/app/contas-pagar',   label: '📤 Contas a Pagar' },
            { path: '/app/contas-receber', label: '📥 Contas a Receber' },
          ].map(t => (
            <a key={t.path} href={t.path}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === t.path
                  ? 'bg-white text-[#152740] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </a>
          ))}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2">
          {isPagar && (
            <button onClick={() => setXmlModal(true)}
              className="px-4 py-2 border border-[#152740] text-[#152740] text-sm font-medium rounded-xl hover:bg-[#152740]/5 transition-colors flex items-center gap-2">
              📄 Importar NF-e (XML)
            </button>
          )}
          <button onClick={() => setModal({ open: true, titulo: null })}
            className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors">
            + {isPagar ? 'Nova Conta a Pagar' : 'Nova Conta a Receber'}
          </button>
        </div>
      </div>

      {/* Mensagem de sucesso XML */}
      {xmlMsg && (
        <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 font-medium">
          {xmlMsg}
        </div>
      )}

      {/* Cards de resumo */}
      {current && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">Total em Aberto</p>
            <p className="text-2xl font-bold text-[#152740] mt-1">{fmt(current.total)}</p>
            <p className="text-xs text-gray-400 mt-1">{current.count} título(s)</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
            <p className="text-sm text-red-500">Vencidos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmt(current.vencido)}</p>
            <p className="text-xs text-gray-400 mt-1">{current.vencidoCount} título(s)</p>
          </div>
          {summary && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-2">
              <p className="text-sm text-gray-500">Resultado Previsto</p>
              <p className={`text-2xl font-bold mt-1 ${
                (summary.receber?.total - summary.pagar?.total) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {fmt((summary.receber?.total || 0) - (summary.pagar?.total || 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">Recebíveis − Obrigações</p>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Buscar..." value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
            <option value="">Todos os status</option>
            <option value="aberto">Em Aberto</option>
            <option value="parcial">Parcial</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Carregando...</div>
        ) : titles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <div className="text-4xl mb-2">{isPagar ? '📤' : '📥'}</div>
            <p>Nenhum título encontrado</p>
            {isPagar && (
              <button onClick={() => setXmlModal(true)}
                className="mt-3 text-sm text-[#152740] underline">
                Importar NF-e via XML
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Descrição</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Vencimento</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Categoria</th>
                <th className="text-right px-3 py-3 text-gray-500 font-medium">Valor</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {titles.map(t => {
                const overdue = isOverdue(t);
                const st = STATUS_STYLE[t.status] || STATUS_STYLE.aberto;
                return (
                  <tr key={t.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#152740]">{t.descricao}</div>
                      {t.nomeContato && <div className="text-xs text-gray-400">{t.nomeContato}</div>}
                      {t.numeroDocumento && <div className="text-xs text-gray-400">Doc: {t.numeroDocumento}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {fmtDate(t.dataVencimento)}
                        {overdue && <span className="ml-1 text-xs">⚠️</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{t.category?.nome || '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-[#152740]">{fmt(t.valor)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(t.status === 'aberto' || t.status === 'parcial') && (
                          <button onClick={() => setBaixaModal({ open: true, titulo: t })}
                            className={`px-3 py-1 text-xs font-medium rounded-lg text-white transition-colors ${
                              isPagar ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                            }`}>
                            {isPagar ? 'Pagar' : 'Receber'}
                          </button>
                        )}
                        {t.status === 'aberto' && (
                          <>
                            <button onClick={() => setModal({ open: true, titulo: t })}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-[#152740] border border-gray-200 rounded-lg">
                              Editar
                            </button>
                            <button onClick={() => handleDelete(t.id)}
                              className="px-3 py-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg">
                              Excluir
                            </button>
                          </>
                        )}
                        {t.status === 'parcial' && (
                          <button onClick={() => handleCancelar(t.id)}
                            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">← Anterior</button>
            <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Próxima →</button>
          </div>
        )}
      </div>

      <TituloModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, titulo: null })}
        onSaved={load}
        titulo={modal.titulo}
        defaultTipo={tipo}
      />
      <BaixaModal
        isOpen={baixaModal.open}
        onClose={() => setBaixaModal({ open: false, titulo: null })}
        onSaved={load}
        titulo={baixaModal.titulo}
      />
      <ImportarXMLModal
        isOpen={xmlModal}
        onClose={() => setXmlModal(false)}
        onImported={handleXmlImported}
      />
    </div>
  );
}
