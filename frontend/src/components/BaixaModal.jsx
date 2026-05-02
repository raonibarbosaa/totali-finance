import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BaixaModal({ isOpen, onClose, onSaved, titulo }) {
  const [form, setForm] = useState({ dataPagamento: '', valorPago: '', bankAccountId: '', observacao: '' });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const today = new Date().toISOString().slice(0, 10);
    setForm({ dataPagamento: today, valorPago: titulo?.valor || '', bankAccountId: '', observacao: '' });
    api.get('/bank-accounts').then(r => setAccounts(r.data.data || []));
  }, [isOpen, titulo]);

  if (!isOpen || !titulo) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isPagar = titulo.tipo === 'pagar';
  const diff = parseFloat(form.valorPago || 0) - parseFloat(titulo.valor || 0);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/titles/${titulo.id}/baixa`, {
        ...form,
        valorPago: parseFloat(form.valorPago),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao efetuar baixa');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className={`flex items-center justify-between px-6 py-4 rounded-t-2xl border-b ${isPagar ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <div>
            <h2 className="text-lg font-semibold text-[#152740]">
              {isPagar ? '💸 Efetuar Pagamento' : '💰 Registrar Recebimento'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{titulo.descricao}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}

          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Valor Original</span>
              <p className="font-semibold text-[#152740]">{fmt(titulo.valor)}</p>
            </div>
            <div>
              <span className="text-gray-500">Vencimento</span>
              <p className="font-semibold text-[#152740]">
                {new Date(titulo.dataVencimento).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {titulo.numeroDocumento && (
              <div><span className="text-gray-500">Documento</span><p className="font-medium">{titulo.numeroDocumento}</p></div>
            )}
            {titulo.nomeContato && (
              <div><span className="text-gray-500">{isPagar ? 'Fornecedor' : 'Cliente'}</span><p className="font-medium truncate">{titulo.nomeContato}</p></div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data do {isPagar ? 'Pagamento' : 'Recebimento'} *</label>
            <input type="date" value={form.dataPagamento} onChange={e => set('dataPagamento', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor {isPagar ? 'Pago' : 'Recebido'} (R$) *</label>
            <input type="number" step="0.01" min="0" value={form.valorPago}
              onChange={e => set('valorPago', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
            {form.valorPago && Math.abs(diff) > 0.01 && (
              <p className={`text-xs mt-1 ${diff < 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                {diff < 0
                  ? `⚠️ Pagamento parcial — falta ${fmt(Math.abs(diff))}`
                  : `ℹ️ Acréscimo de ${fmt(diff)} (juros/multa)`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária *</label>
            <select value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
              <option value="">Selecione a conta</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.nome} — {a.banco}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <input type="text" value={form.observacao} onChange={e => set('observacao', e.target.value)}
              placeholder="Juros, desconto, referência..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button onClick={handleSubmit}
            disabled={loading || !form.valorPago || !form.bankAccountId || !form.dataPagamento}
            className={`px-6 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors ${
              isPagar ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}>
            {loading ? 'Processando...' : isPagar ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  );
}
