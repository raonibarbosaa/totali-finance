import { useState, useEffect } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import Modal from './Modal';
import { useBankAccounts, useCategoriesGrouped } from '../../hooks/useFinanceData';

const TIPOS = [
  { value: 'receita',      label: 'Receita',      cor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'despesa',      label: 'Despesa',       cor: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'transferencia',label: 'Transferência', cor: 'text-blue-600 bg-blue-50 border-blue-200' },
];

const EMPTY = {
  tipo: 'despesa',
  dataLancamento: new Date().toISOString().substring(0, 10),
  valor: '',
  categoryId: '',
  bankAccountId: '',
  bankAccountIdOrigem: '',
  bankAccountIdDestino: '',
  descricao: '',
  complemento: '',
  dataCompetencia: '',
  // Domínio (override)
  contaDebito: '', contaCredito: '',
  codHistorico: '', centroCustoD: '', centroCustoC: '',
};

export default function TransactionModal({ open, onClose, onSaved, editando = null }) {
  const { contas }  = useBankAccounts();
  const { grupos }  = useCategoriesGrouped();

  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [erro, setErro]         = useState('');
  const [showDominio, setShowDominio] = useState(false);

  // Preenche ao editar
  useEffect(() => {
    if (editando) {
      setForm({
        tipo:                  editando.tipo,
        dataLancamento:        editando.dataLancamento?.substring(0, 10) || '',
        valor:                 editando.valor,
        categoryId:            editando.categoryId || '',
        bankAccountId:         editando.bankAccountId || '',
        bankAccountIdOrigem:   '',
        bankAccountIdDestino:  '',
        descricao:             editando.descricao || '',
        complemento:           editando.complemento || '',
        dataCompetencia:       editando.dataCompetencia?.substring(0, 10) || '',
        contaDebito:           editando.contaDebito || '',
        contaCredito:          editando.contaCredito || '',
        codHistorico:          editando.codHistorico || '',
        centroCustoD:          editando.centroCustoD || '',
        centroCustoC:          editando.centroCustoC || '',
      });
    } else {
      setForm(EMPTY);
    }
    setErro('');
  }, [editando, open]);

  // Quando muda categoria, herda campos Domínio (se vazios)
  function handleCategoryChange(categoryId) {
    const todasCats = [
      ...(grupos.receita || []),
      ...(grupos.despesa || []),
      ...(grupos.transferencia || []),
    ];
    const cat = todasCats.find(c => c.id === categoryId);
    setForm(prev => ({
      ...prev,
      categoryId,
      contaDebito:  prev.contaDebito  || cat?.contaDebito  || '',
      contaCredito: prev.contaCredito || cat?.contaCredito || '',
      codHistorico: prev.codHistorico || cat?.codHistorico || '',
      centroCustoD: prev.centroCustoD || cat?.centroCustoD || '',
      centroCustoC: prev.centroCustoC || cat?.centroCustoC || '',
    }));
  }

  async function salvar() {
    setErro('');
    if (!form.tipo || !form.valor || !form.dataLancamento) {
      setErro('Tipo, valor e data são obrigatórios.');
      return;
    }
    if (isNaN(parseFloat(form.valor)) || parseFloat(form.valor) <= 0) {
      setErro('Informe um valor válido maior que zero.');
      return;
    }
    if (form.tipo === 'transferencia') {
      if (!form.bankAccountIdOrigem) {
        setErro('Selecione a conta de origem.');
        return;
      }
      if (!form.bankAccountIdDestino) {
        setErro('Selecione a conta de destino.');
        return;
      }
      if (form.bankAccountIdOrigem === form.bankAccountIdDestino) {
        setErro('Conta de origem e destino devem ser diferentes.');
        return;
      }
      if (!form.descricao) {
        setErro('Descrição é obrigatória.');
        return;
      }
    }

    setSaving(true);
    try {
      const api = (await import('../../services/api')).default;
      const payload = { ...form, valor: parseFloat(form.valor) };

      if (editando) {
        await api.put(`/transactions/${editando.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar lançamento.');
    }
    setSaving(false);
  }

  const catsFiltradas    = grupos[form.tipo] || [];
  const isTransferencia  = form.tipo === 'transferencia';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar lançamento' : 'Novo lançamento'}
      size="lg"
    >
      <div className="space-y-4">

        {/* Tipo */}
        <div>
          <label className="input-label">Tipo *</label>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(prev => ({
                  ...prev,
                  tipo: t.value,
                  categoryId: '',
                  bankAccountId: '',
                  bankAccountIdOrigem: '',
                  bankAccountIdDestino: '',
                }))}
                className={`py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  form.tipo === t.value
                    ? t.cor + ' border-current'
                    : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data + Valor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Data *</label>
            <input type="date" className="input-field"
              value={form.dataLancamento}
              onChange={e => setForm({ ...form, dataLancamento: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Valor (R$) *</label>
            <input
              type="number" step="0.01" min="0.01"
              className="input-field"
              placeholder="0,00"
              value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })}
            />
          </div>
        </div>

        {/* Categoria — só Receita/Despesa */}
        {!isTransferencia && (
          <div>
            <label className="input-label">Categoria</label>
            <select className="input-field" value={form.categoryId}
              onChange={e => handleCategoryChange(e.target.value)}>
              <option value="">Sem categoria</option>
              {catsFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Conta bancária — Receita/Despesa: 1 dropdown. Transferência: 2 dropdowns */}
        {!isTransferencia ? (
          <div>
            <label className="input-label">Conta bancária</label>
            <select className="input-field" value={form.bankAccountId}
              onChange={e => setForm({ ...form, bankAccountId: e.target.value })}>
              <option value="">Selecionar conta</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` — ${c.banco}` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Conta de origem *</label>
              <select className="input-field" value={form.bankAccountIdOrigem}
                onChange={e => setForm({ ...form, bankAccountIdOrigem: e.target.value })}>
                <option value="">Selecionar</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}
                    disabled={c.id === form.bankAccountIdDestino}>
                    {c.nome}{c.banco ? ` — ${c.banco}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Conta de destino *</label>
              <select className="input-field" value={form.bankAccountIdDestino}
                onChange={e => setForm({ ...form, bankAccountIdDestino: e.target.value })}>
                <option value="">Selecionar</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}
                    disabled={c.id === form.bankAccountIdOrigem}>
                    {c.nome}{c.banco ? ` — ${c.banco}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Descrição */}
        <div>
          <label className="input-label">
            Descrição{isTransferencia ? ' *' : ''}
          </label>
          <input className="input-field" placeholder="Ex: Pagamento NF 5542"
            value={form.descricao}
            onChange={e => setForm({ ...form, descricao: e.target.value })} />
        </div>

        {/* Complemento */}
        <div>
          <label className="input-label">Complemento</label>
          <input className="input-field" placeholder="Texto adicional (vai para o Domínio)"
            value={form.complemento}
            onChange={e => setForm({ ...form, complemento: e.target.value })} />
        </div>

        {/* Data competência — só Receita/Despesa */}
        {!isTransferencia && (
          <div>
            <label className="input-label">Data de competência
              <span className="text-slate-400 font-normal"> (opcional — regime competência)</span>
            </label>
            <input type="date" className="input-field"
              value={form.dataCompetencia}
              onChange={e => setForm({ ...form, dataCompetencia: e.target.value })} />
          </div>
        )}

        {/* Campos Domínio — colapsável */}
        <div>
          <button
            type="button"
            onClick={() => setShowDominio(!showDominio)}
            className="flex items-center gap-2 text-xs font-medium text-navy-600
                       hover:text-navy-800 transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${showDominio ? 'rotate-180' : ''}`} />
            Campos Domínio Contábil
            {(form.contaDebito || form.contaCredito) && (
              <span className="px-1.5 py-0.5 bg-navy-100 text-navy-700 rounded text-[10px]">
                configurado
              </span>
            )}
          </button>

          {showDominio && (
            <div className="mt-3 p-4 bg-slate-50 rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-start gap-2 mb-2">
                <Info size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  Preenchidos automaticamente pela categoria. Altere apenas se necessário
                  para este lançamento específico.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="input-label">Cto. Débito</label>
                  <input className="input-field font-mono text-xs" placeholder="—"
                    value={form.contaDebito}
                    onChange={e => setForm({ ...form, contaDebito: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Cto. Crédito</label>
                  <input className="input-field font-mono text-xs" placeholder="—"
                    value={form.contaCredito}
                    onChange={e => setForm({ ...form, contaCredito: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Cód. Histórico</label>
                  <input className="input-field font-mono text-xs" placeholder="—"
                    value={form.codHistorico}
                    onChange={e => setForm({ ...form, codHistorico: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label">CC Débito</label>
                  <input className="input-field font-mono text-xs" placeholder="—"
                    value={form.centroCustoD}
                    onChange={e => setForm({ ...form, centroCustoD: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">CC Crédito</label>
                  <input className="input-field font-mono text-xs" placeholder="—"
                    value={form.centroCustoC}
                    onChange={e => setForm({ ...form, centroCustoC: e.target.value })} />
                </div>
              </div>
            </div>
          )}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                          px-4 py-3 rounded-lg">{erro}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={salvar} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Check size={15} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
