import { useState, useEffect } from 'react';
import api from '../services/api';

export default function TituloModal({ isOpen, onClose, onSaved, titulo, defaultTipo }) {
  const [form, setForm] = useState({
    tipo: defaultTipo || 'pagar',
    descricao: '',
    valor: '',
    dataEmissao: new Date().toISOString().slice(0, 10),
    dataVencimento: '',
    categoryId: '',
    numeroDocumento: '',
    nomeContato: '',
    observacao: '',
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    api.get('/categories').then(r => {
      const cats = r.data.data || [];
      setCategories(cats);
    });
    if (titulo) {
      setForm({
        tipo: titulo.tipo || defaultTipo || 'pagar',
        descricao: titulo.descricao || '',
        valor: titulo.valor || '',
        dataEmissao: titulo.dataEmissao?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        dataVencimento: titulo.dataVencimento?.slice(0, 10) || '',
        categoryId: titulo.categoryId || '',
        numeroDocumento: titulo.numeroDocumento || '',
        nomeContato: titulo.nomeContato || '',
        observacao: titulo.observacao || '',
      });
    } else {
      setForm(f => ({ ...f, tipo: defaultTipo || 'pagar' }));
    }
  }, [isOpen, titulo, defaultTipo]);

  if (!isOpen) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isPagar = form.tipo === 'pagar';
  const isPaid = titulo?.status === 'pago' || titulo?.status === 'cancelado';

  const filteredCategories = categories.filter(c =>
    isPagar ? c.tipo === 'despesa' : c.tipo === 'receita'
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        valor: parseFloat(form.valor),
      };
      if (titulo) {
        await api.put(`/titles/${titulo.id}`, payload);
      } else {
        await api.post('/titles', payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-[#152740]">
            {titulo ? 'Editar Título' : `Novo ${isPagar ? 'Conta a Pagar' : 'Conta a Receber'}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}

          {/* Tipo */}
          {!titulo && (
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {[
                { value: 'pagar',   label: '📤 Conta a Pagar' },
                { value: 'receber', label: '📥 Conta a Receber' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('tipo', opt.value)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    form.tipo === opt.value ? 'bg-[#152740] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" value={form.descricao} onChange={e => set('descricao', e.target.value)}
              disabled={isPaid}
              placeholder={isPagar ? 'Ex: NF 1234 - Fornecedor X' : 'Ex: Recebimento Cliente Y'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
          </div>

          {/* Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.valor}
                onChange={e => set('valor', e.target.value)} disabled={isPaid}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento *</label>
              <input type="date" value={form.dataVencimento}
                onChange={e => set('dataVencimento', e.target.value)} disabled={isPaid}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
            </div>
          </div>

          {/* Emissão */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Emissão</label>
            <input type="date" value={form.dataEmissao}
              onChange={e => set('dataEmissao', e.target.value)} disabled={isPaid}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
              disabled={isPaid}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50">
              <option value="">Selecione uma categoria</option>
              {filteredCategories.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Doc e Contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Documento</label>
              <input type="text" value={form.numeroDocumento}
                onChange={e => set('numeroDocumento', e.target.value)} disabled={isPaid}
                placeholder="NF, boleto..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isPagar ? 'Fornecedor' : 'Cliente'}
              </label>
              <input type="text" value={form.nomeContato}
                onChange={e => set('nomeContato', e.target.value)} disabled={isPaid}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)}
              disabled={isPaid} rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 disabled:bg-gray-50 resize-none" />
          </div>

          {isPaid && (
            <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-2">
              Este título está <strong>{titulo.status}</strong> e não pode ser editado.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          {!isPaid && (
            <button onClick={handleSubmit} disabled={loading}
              className="px-6 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors">
              {loading ? 'Salvando...' : titulo ? 'Salvar' : 'Criar Título'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
