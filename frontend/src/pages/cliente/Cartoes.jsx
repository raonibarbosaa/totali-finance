// Cadastro de cartões de crédito.
//
// Cartão não é conta bancária: não tem saldo, tem limite e fatura. O vínculo
// com o banco é a conta DE ONDE a fatura é paga.

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Plus, Edit2, Trash2, Check, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import creditCardsService from '../../services/creditCardsService';
import api from '../../services/api';
import { useBankAccounts } from '../../hooks/useFinanceData';
import useRole from '../../hooks/useRole';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency } from '../../utils/formatters';

const EMPTY = {
  nome: '', emissor: 'auto', bandeira: '', ultimos4: '',
  limite: '', diaFechamento: '', diaVencimento: '', bankAccountId: '',
  contaCartao: '', categoryIdFatura: '',
};

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard'];

export default function Cartoes() {
  const { hasRole } = useRole();
  const { contas }  = useBankAccounts();
  const [categorias, setCategorias] = useState([]);

  const [cartoes, setCartoes]   = useState([]);
  const [emissores, setEmissores] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [erro, setErro]         = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e, cat] = await Promise.all([
        creditCardsService.listCards(),
        creditCardsService.emissores(),
        api.get('/categories'),
      ]);
      setCartoes(c.data.data || []);
      setEmissores(e.data.data || []);
      // /categories pode vir agrupado por tipo; normaliza os dois formatos.
      const lista = cat.data.data;
      setCategorias(Array.isArray(lista) ? lista : Object.values(lista || {}).flat());
    } catch (_) {
      setCartoes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrir(cartao = null) {
    setErro('');
    setEditando(cartao);
    setForm(cartao ? {
      nome: cartao.nome,
      emissor: cartao.emissor || 'auto',
      bandeira: cartao.bandeira || '',
      ultimos4: cartao.ultimos4 || '',
      limite: cartao.limite ?? '',
      diaFechamento: cartao.diaFechamento ?? '',
      diaVencimento: cartao.diaVencimento ?? '',
      bankAccountId: cartao.bankAccountId || '',
      contaCartao: cartao.contaCartao || '',
      categoryIdFatura: cartao.categoryIdFatura || '',
    } : EMPTY);
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.nome.trim()) { setErro('Nome do cartão é obrigatório.'); return; }
    setSaving(true);
    try {
      if (editando) await creditCardsService.updateCard(editando.id, form);
      else          await creditCardsService.createCard(form);
      setModal(false);
      carregar();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function desativar(id) {
    try {
      await creditCardsService.removeCard(id);
      setConfirmDel(null);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao desativar.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Cartões de Crédito</h2>
          <p className="text-sm text-slate-400">
            {cartoes.length} cartão{cartoes.length !== 1 ? 'ões' : ''} cadastrado{cartoes.length !== 1 ? 's' : ''}
          </p>
        </div>
        {hasRole(1) && (
          <button onClick={() => abrir()} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Novo cartão
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-32" />
              <div className="h-8 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>
      ) : cartoes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão para importar as faturas em PDF e separar as compras."
            action={hasRole(1) && (
              <button onClick={() => abrir()} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Cadastrar cartão
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cartoes.map((c) => (
            <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-navy-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} className="text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-800 text-sm">{c.nome}</p>
                    <p className="text-xs text-slate-400">
                      {[c.bandeira, c.ultimos4 && `final ${c.ultimos4}`].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {c.limite != null && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-0.5">Limite</p>
                  <p className="font-display font-semibold text-xl text-navy-800">
                    {formatCurrency(c.limite)}
                  </p>
                </div>
              )}

              <div className="flex gap-4 mb-3 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">Fechamento</p>
                  <p className="font-medium text-slate-600">
                    {c.diaFechamento ? `dia ${c.diaFechamento}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Vencimento</p>
                  <p className="font-medium text-slate-600">
                    {c.diaVencimento ? `dia ${c.diaVencimento}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Paga por</p>
                  <p className="font-medium text-slate-600">{c.bankAccount?.nome || '—'}</p>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                <Link
                  to={`/app/faturas-cartao?cartao=${c.id}`}
                  className="flex items-center gap-1.5 text-[11px] text-navy-700 hover:underline"
                >
                  <FileText size={12} />
                  {c.totalFaturas || 0} fatura{c.totalFaturas === 1 ? '' : 's'}
                </Link>
                {hasRole(1) && (
                  <div className="flex gap-1">
                    <button onClick={() => abrir(c)} title="Editar"
                      className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50 rounded transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setConfirmDel(c)} title="Desativar"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de cadastro */}
      <Modal open={modal} onClose={() => setModal(false)}
             title={editando ? 'Editar cartão' : 'Novo cartão'} size="md">
        <div className="space-y-4">
          <div>
            <label className="input-label">Nome do cartão *</label>
            <input className="input-field" placeholder="Ex: Nubank PJ"
              value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Bandeira</label>
              <select className="input-field" value={form.bandeira}
                onChange={(e) => setForm({ ...form, bandeira: e.target.value })}>
                <option value="">—</option>
                {BANDEIRAS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Últimos 4 dígitos</label>
              <input className="input-field" placeholder="0000" maxLength={4}
                value={form.ultimos4}
                onChange={(e) => setForm({ ...form, ultimos4: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Limite (R$)</label>
              <input type="number" step="0.01" className="input-field" placeholder="0,00"
                value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Dia fechamento</label>
              <input type="number" min="1" max="31" className="input-field" placeholder="25"
                value={form.diaFechamento}
                onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Dia vencimento</label>
              <input type="number" min="1" max="31" className="input-field" placeholder="5"
                value={form.diaVencimento}
                onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="input-label">Conta que paga a fatura</label>
            <select className="input-field" value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
              <option value="">— Não informada —</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              É por aqui que o pagamento da fatura vai virar lançamento na conta corrente.
            </p>
          </div>

          {/* Codificação contábil. Sem ela a geração de lançamentos não roda. */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Contabilidade
            </p>
            <div>
              <label className="input-label">Conta de cartão a pagar</label>
              <input className="input-field" placeholder="Ex: 2.1.01"
                value={form.contaCartao}
                onChange={(e) => setForm({ ...form, contaCartao: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-1">
                Vai no crédito de cada compra. A despesa é debitada na conta da categoria e
                creditada aqui, porque o dinheiro ainda não saiu do banco.
              </p>
            </div>
            <div>
              <label className="input-label">Categoria do pagamento da fatura</label>
              <select className="input-field" value={form.categoryIdFatura}
                onChange={(e) => setForm({ ...form, categoryIdFatura: e.target.value })}>
                <option value="">— Não informada —</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Usada no título a pagar que a fatura gera. Quando você baixa o título, ela
                debita cartão a pagar e credita o banco.
              </p>
            </div>
          </div>

          {/* O emissor decide qual leitor de PDF é usado na importação. */}
          <div>
            <label className="input-label">Leitor da fatura</label>
            <select className="input-field" value={form.emissor}
              onChange={(e) => setForm({ ...form, emissor: e.target.value })}>
              {emissores.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Cada emissor tem um layout de fatura. Enquanto não existir leitor do seu
              banco, o genérico tenta dar conta do formato mais comum.
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Check size={15} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Desativar cartão" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Desativar o cartão <strong>{confirmDel?.nome}</strong>? As faturas já
            importadas continuam guardadas.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => desativar(confirmDel.id)} className="btn-danger flex-1">Desativar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
