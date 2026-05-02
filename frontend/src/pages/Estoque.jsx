import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Estoque() {
  const [current, setCurrent]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState({ date: new Date().toISOString().slice(0,10), value: '', notes: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const load = () => {
    api.get('/stock/current').then(r => setCurrent(r.data.data));
    api.get('/stock').then(r => setHistory(r.data.data || []));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/stock', { ...form, value: parseFloat(form.value) });
      setModal(false);
      setForm({ date: new Date().toISOString().slice(0,10), value: '', notes: '' });
      load();
    } catch (e) { setError(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este ajuste?')) return;
    await api.delete(`/stock/${id}`);
    load();
  };

  const estimatedCurrent = current
    ? current.latest_value + current.purchases_this_month
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Controle de Estoque</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajuste manual do valor do estoque por período</p>
        </div>
        <button onClick={() => setModal(true)}
          className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f]">
          + Registrar Ajuste
        </button>
      </div>

      {/* Cards */}
      {current && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">Último Valor Registrado</p>
            <p className="text-2xl font-bold text-[#152740] mt-1">{fmt(current.latest_value)}</p>
            {current.latest_adjustment && (
              <p className="text-xs text-gray-400 mt-1">
                em {new Date(current.latest_adjustment.date).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">Compras no Mês Atual</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(current.purchases_this_month)}</p>
            <p className="text-xs text-gray-400 mt-1">categoria "Compra de Mercadorias"</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">Estoque Estimado</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(estimatedCurrent)}</p>
            <p className="text-xs text-gray-400 mt-1">Último ajuste + compras do mês</p>
          </div>
        </div>
      )}

      {/* Aviso sobre CMV */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        <strong>Como funciona o CMV na DRE:</strong> Registre o valor do estoque ao final de cada período.
        O sistema calcula: <span className="font-mono bg-blue-100 px-1 rounded">CMV = Estoque Inicial + Compras − Estoque Final</span>.
        Lançamentos na categoria <em>"Compra de Mercadorias"</em> são identificados automaticamente.
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#152740]">Histórico de Ajustes</h2>
        </div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <div className="text-3xl mb-2">📦</div>
            <p>Nenhum ajuste registrado ainda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Data</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Mês/Ano</th>
                <th className="text-right px-3 py-3 text-gray-500 font-medium">Valor</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Observações</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {history.map(adj => (
                <tr key={adj.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-gray-600">{new Date(adj.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-3 text-gray-500">{String(adj.month).padStart(2,'0')}/{adj.year}</td>
                  <td className="px-3 py-3 text-right font-semibold text-[#152740]">{fmt(adj.value)}</td>
                  <td className="px-3 py-3 text-gray-400">{adj.notes || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(adj.id)}
                      className="px-3 py-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de ajuste */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-[#152740]">Registrar Ajuste de Estoque</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Inventário *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Estoque (R$) *</label>
                <input type="number" step="0.01" min="0" value={form.value}
                  onChange={e => setForm(f => ({...f, value: e.target.value}))}
                  placeholder="0,00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="Ex: Inventário mensal de abril/2026"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm text-gray-600">Cancelar</button>
              <button onClick={handleSave} disabled={loading || !form.value}
                className="px-6 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
