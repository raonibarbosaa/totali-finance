import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseLocalDate(raw) {
  if (!raw) return null;
  const str = typeof raw === 'string' ? raw : new Date(raw).toISOString();
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(raw) {
  const d = parseLocalDate(raw);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

function formatMonthYear(raw) {
  const d = parseLocalDate(raw);
  if (!d) return '—';
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

function fmt(v) {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { date: todayISO(), value: '', notes: '' };

export default function Estoque() {
  const [adjustments, setAdjustments] = useState([]);
  const [summary, setSummary]         = useState({ latestValue: 0, purchasesThisMonth: 0 });
  const [modal, setModal]             = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [listRes, curRes] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/current'),
      ]);
      setAdjustments(listRes.data?.data ?? []);
      setSummary(curRes.data?.data ?? { latestValue: 0, purchasesThisMonth: 0 });
    } catch (e) {
      console.error('Erro ao carregar estoque:', e);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModal(true);
  }

  function openEdit(adj) {
    setEditingId(adj.id);
    setForm({
      date:  adj.competencia ? adj.competencia.slice(0, 10) : todayISO(),
      value: String(adj.valorEstoque ?? ''),
      notes: adj.observacao ?? '',
    });
    setError('');
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSave() {
    if (!form.date)  { setError('Data é obrigatória.');  return; }
    if (!form.value) { setError('Valor é obrigatório.'); return; }
    setLoading(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/stock/${editingId}`, form);
      } else {
        await api.post('/stock', form);
      }
      await fetchData();
      closeModal();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Erro ao salvar ajuste.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este ajuste de estoque?')) return;
    try {
      await api.delete(`/stock/${id}`);
      await fetchData();
    } catch {
      alert('Erro ao excluir ajuste.');
    }
  }

  const estimated = (summary.latestValue ?? 0) + (summary.purchasesThisMonth ?? 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Controle de Estoque</h1>
          <p className="text-sm text-gray-500 mt-1">Ajuste manual do valor do estoque por período</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors">
          + Registrar Ajuste
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Último Valor Registrado</p>
          <p className="text-2xl font-bold text-[#152740] mt-1">{fmt(summary.latestValue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Compras no Mês Atual</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(summary.purchasesThisMonth)}</p>
          <p className="text-xs text-gray-400 mt-1">categoria "Compra de Mercadorias"</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Estoque Estimado</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{fmt(estimated)}</p>
          <p className="text-xs text-gray-400 mt-1">Último ajuste + compras do mês</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-800">
        <span className="font-semibold">Como funciona o CMV na DRE:</span> Registre o valor do estoque ao
        final de cada período. O sistema calcula:{' '}
        <code className="bg-blue-100 px-1 rounded text-xs">CMV = Estoque Inicial + Compras − Estoque Final</code>.
        Lançamentos na categoria <span className="italic">"Compra de Mercadorias"</span> são identificados automaticamente.
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-[#152740]">Histórico de Ajustes</h2>
        </div>
        {adjustments.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Nenhum ajuste registrado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Data</th>
                <th className="px-6 py-3 text-left">Mês/Ano</th>
                <th className="px-6 py-3 text-right">Valor</th>
                <th className="px-6 py-3 text-left">Observações</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {adjustments.map(adj => (
                <tr key={adj.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-700">{formatDate(adj.competencia)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatMonthYear(adj.competencia)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-[#152740]">{fmt(adj.valorEstoque)}</td>
                  <td className="px-6 py-4 text-gray-400">{adj.observacao || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(adj)} className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-100 hover:border-blue-300 rounded-lg transition-colors">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(adj.id)} className="px-3 py-1 text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg transition-colors">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-[#152740]">
                {editingId ? 'Editar Ajuste de Estoque' : 'Registrar Ajuste de Estoque'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Inventário *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Estoque (R$) *</label>
                <input type="number" step="0.01" min="0" value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex: Inventário mensal de maio/2026"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={closeModal} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={handleSave} disabled={loading || !form.value || !form.date}
                className="px-6 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors">
                {loading ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
