import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, Plus, Edit2, Trash2, Check, TrendingUp,
  TrendingDown, Wallet
} from 'lucide-react';
import api from '../../services/api';
import useRole from '../../hooks/useRole';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency } from '../../utils/formatters';

const TIPOS = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_CORES = {
  corrente: 'bg-blue-100 text-blue-700',
  poupanca: 'bg-emerald-100 text-emerald-700',
  caixa: 'bg-amber-100 text-amber-700',
  outro: 'bg-slate-100 text-slate-600',
};

const EMPTY = {
  nome: '', banco: '', agencia: '', conta: '',
  tipo: 'corrente', saldoInicial: '', dataSaldoInicial: '',
};

export default function ContasBancarias() {
  const { hasRole } = useRole();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bank-accounts?saldo=true');
      setContas(data.data || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal(conta = null) {
    setErro('');
    if (conta) {
      setEditando(conta);
      setForm({
        nome: conta.nome,
        banco: conta.banco || '',
        agencia: conta.agencia || '',
        conta: conta.conta || '',
        tipo: conta.tipo,
        saldoInicial: conta.saldoInicial,
        dataSaldoInicial: conta.dataSaldoInicial
          ? conta.dataSaldoInicial.substring(0, 10) : '',
      });
    } else {
      setEditando(null);
      setForm(EMPTY);
    }
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.nome.trim()) {
      setErro('Nome da conta é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        saldoInicial: parseFloat(form.saldoInicial) || 0,
        dataSaldoInicial: form.dataSaldoInicial || null,
      };
      if (editando) {
        await api.put(`/bank-accounts/${editando.id}`, payload);
      } else {
        await api.post('/bank-accounts', payload);
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function desativar(id) {
    try {
      await api.delete(`/bank-accounts/${id}`);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desativar.');
    }
  }

  const totalSaldo = contas.reduce((acc, c) => acc + (c.saldoAtual || 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">
            Contas Bancárias
          </h2>
          <p className="text-sm text-slate-400">
            {contas.length} conta{contas.length !== 1 ? 's' : ''} cadastrada{contas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {hasRole(1) && (
          <button
            onClick={() => abrirModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={15} /> Nova conta
          </button>
        )}
      </div>

      {/* Card de saldo total */}
      {contas.length > 0 && (
        <div className="card p-5 bg-navy-800 border-navy-700">
          <p className="text-navy-300 text-xs font-medium mb-1">Saldo total — todas as contas</p>
          <p className={`font-display font-bold text-3xl ${
            totalSaldo >= 0 ? 'text-white' : 'text-red-400'
          }`}>
            {formatCurrency(totalSaldo)}
          </p>
        </div>
      )}

      {/* Grid de contas */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-32" />
              <div className="h-8 bg-slate-100 rounded w-24" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      ) : contas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Landmark}
            title="Nenhuma conta cadastrada"
            description="Cadastre suas contas bancárias para começar a lançar movimentações."
            action={
              hasRole(1) && (
                <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Cadastrar conta
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contas.map((conta) => (
            <div key={conta.id} className="card p-5 hover:shadow-md transition-shadow">
              {/* Header do card */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-navy-100 rounded-xl flex items-center
                                  justify-center flex-shrink-0">
                    <Landmark size={16} className="text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-800 text-sm">{conta.nome}</p>
                    {conta.banco && (
                      <p className="text-xs text-slate-400">{conta.banco}</p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                  ${TIPO_CORES[conta.tipo]}`}>
                  {TIPOS.find(t => t.value === conta.tipo)?.label}
                </span>
              </div>

              {/* Saldo */}
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-0.5">Saldo atual</p>
                <p className={`font-display font-semibold text-2xl ${
                  (conta.saldoAtual || 0) >= 0 ? 'text-navy-800' : 'text-red-500'
                }`}>
                  {formatCurrency(conta.saldoAtual || 0)}
                </p>
              </div>

              {/* Dados bancários */}
              {(conta.agencia || conta.conta) && (
                <div className="flex gap-4 mb-3">
                  {conta.agencia && (
                    <div>
                      <p className="text-[10px] text-slate-400">Agência</p>
                      <p className="text-xs font-medium text-slate-600">{conta.agencia}</p>
                    </div>
                  )}
                  {conta.conta && (
                    <div>
                      <p className="text-[10px] text-slate-400">Conta</p>
                      <p className="text-xs font-medium text-slate-600">{conta.conta}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Saldo inicial */}
              <div className="border-t border-slate-50 pt-3 flex items-center
                              justify-between">
                <p className="text-[10px] text-slate-400">
                  Saldo inicial: {formatCurrency(conta.saldoInicial)}
                </p>
                {hasRole(1) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => abrirModal(conta)}
                      className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50
                                 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(conta)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50
                                 rounded transition-colors"
                      title="Desativar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar conta bancária' : 'Nova conta bancária'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Nome da conta *</label>
            <input className="input-field" placeholder="Ex: Bradesco Corrente"
              value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Banco</label>
              <input className="input-field" placeholder="Ex: Bradesco"
                value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Tipo *</label>
              <select className="input-field" value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Agência</label>
              <input className="input-field" placeholder="0000"
                value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Conta</label>
              <input className="input-field" placeholder="00000-0"
                value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Saldo inicial
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Valor (R$)</label>
                <input
                  type="number" step="0.01" className="input-field"
                  placeholder="0,00"
                  value={form.saldoInicial}
                  onChange={e => setForm({ ...form, saldoInicial: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Data de referência</label>
                <input
                  type="date" className="input-field"
                  value={form.dataSaldoInicial}
                  onChange={e => setForm({ ...form, dataSaldoInicial: e.target.value })}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              O saldo atual será calculado a partir desta data e valor.
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                            px-4 py-3 rounded-lg">{erro}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
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

      {/* Modal confirmação desativar */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Desativar conta" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Deseja desativar a conta <strong>{confirmDelete?.nome}</strong>?
            Os lançamentos vinculados serão mantidos.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={() => desativar(confirmDelete.id)} className="btn-danger flex-1">
              Desativar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
