// De-para do cartão: texto do estabelecimento para categoria e fornecedor.
//
// Separado do de-para de OFX de propósito. Fatura é quase toda nome de loja;
// extrato bancário é histórico genérico. Um padrão criado para um classificaria
// errado o outro.
//
// Duas diferenças em relação ao de-para de OFX:
//   - prioridade, e no empate vence o texto mais específico
//   - o complemento automático é aplicado de verdade no lançamento

import { useCallback, useEffect, useState } from 'react';
import { Tags, Plus, Edit2, Trash2, Check, ArrowUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import cardPatternsService from '../../services/cardPatternsService';
import api from '../../services/api';
import useRole from '../../hooks/useRole';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY = { texto: '', categoryId: '', supplierId: '', complementoAuto: '', prioridade: 0 };

export default function PadroesCartao() {
  const { hasRole } = useRole();
  const [params, setParams] = useSearchParams();

  const [padroes, setPadroes]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
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
      const [p, c, f] = await Promise.all([
        cardPatternsService.list(),
        api.get('/categories'),
        api.get('/suppliers'),
      ]);
      setPadroes(p.data.data || []);
      // /categories pode vir agrupado por tipo ou plano; normaliza os dois.
      const cats = c.data.data;
      setCategorias(Array.isArray(cats) ? cats : Object.values(cats || {}).flat());
      const forn = f.data.data;
      setFornecedores(Array.isArray(forn) ? forn : (forn?.data || []));
    } catch (_) {
      setPadroes([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // A tela da fatura manda "criar regra a partir desta linha" pela URL.
  useEffect(() => {
    const texto = params.get('texto');
    if (!texto) return;
    setEditando(null);
    setForm({ ...EMPTY, texto });
    setModal(true);
    setParams({}, { replace: true });
  }, [params, setParams]);

  function abrir(padrao = null) {
    setErro('');
    setEditando(padrao);
    setForm(padrao ? {
      texto: padrao.texto,
      categoryId: padrao.categoryId || '',
      supplierId: padrao.supplierId || '',
      complementoAuto: padrao.complementoAuto || '',
      prioridade: padrao.prioridade ?? 0,
    } : EMPTY);
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.texto.trim()) { setErro('Informe o texto do padrão.'); return; }
    if (!form.categoryId && !form.supplierId) {
      setErro('Informe ao menos a categoria ou o fornecedor.');
      return;
    }
    setSaving(true);
    try {
      if (editando) await cardPatternsService.update(editando.id, form);
      else          await cardPatternsService.create(form);
      setModal(false);
      carregar();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function excluir(id) {
    try {
      await cardPatternsService.remove(id);
      setConfirmDel(null);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Padrões de Cartão</h2>
          <p className="text-sm text-slate-400">
            {padroes.length} regra{padroes.length !== 1 ? 's' : ''} para classificar as compras
          </p>
        </div>
        {hasRole(1) && (
          <button onClick={() => abrir()} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Nova regra
          </button>
        )}
      </div>

      <div className="card p-4 bg-slate-50 border-slate-200">
        <p className="text-xs text-slate-600 leading-relaxed">
          Ao importar uma fatura, cada compra é comparada com estas regras. Se a descrição
          <strong> contiver</strong> o texto da regra, a compra recebe a categoria e o
          fornecedor dela. Acento, maiúscula e espaço extra não atrapalham.
          <br />
          Quando duas regras casam com a mesma compra, ganha a de maior prioridade. Empatando,
          ganha o <strong>texto mais longo</strong>, que é o mais específico.
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-400">Carregando...</div>
      ) : padroes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title="Nenhuma regra cadastrada"
            description="Cadastre regras para o sistema classificar sozinho as compras das próximas faturas."
            action={hasRole(1) && (
              <button onClick={() => abrir()} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Criar primeira regra
              </button>
            )}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Quando contiver</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Categoria</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Fornecedor</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Complemento</th>
                <th className="text-center px-4 py-2 text-slate-500 font-medium">Prioridade</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {padroes.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-navy-800">{p.texto}</td>
                  <td className="px-4 py-2 text-slate-600">{p.category?.nome || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{p.supplier?.nome || '—'}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{p.complementoAuto || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    {p.prioridade > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-700">
                        <ArrowUp size={11} /> {p.prioridade}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {hasRole(1) && (
                      <>
                        <button onClick={() => abrir(p)} title="Editar"
                          className="p-1.5 text-slate-400 hover:text-navy-700 rounded">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setConfirmDel(p)} title="Excluir"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
             title={editando ? 'Editar regra' : 'Nova regra'} size="md">
        <div className="space-y-4">
          <div>
            <label className="input-label">Quando a compra contiver *</label>
            <input className="input-field" placeholder="Ex: APPLE.COM/BILL"
              value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
            <p className="text-[10px] text-slate-400 mt-1">
              Um pedaço do nome que aparece na fatura. Quanto mais específico, melhor.
            </p>
          </div>

          <div>
            <label className="input-label">Categoria</label>
            <select className="input-field" value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">—</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="input-label">Fornecedor</label>
            <select className="input-field" value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">—</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Informe pelo menos a categoria ou o fornecedor.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Complemento automático</label>
              <input className="input-field" placeholder="Ex: Assinatura mensal"
                value={form.complementoAuto}
                onChange={(e) => setForm({ ...form, complementoAuto: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Prioridade</label>
              <input type="number" className="input-field" placeholder="0"
                value={form.prioridade}
                onChange={(e) => setForm({ ...form, prioridade: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-1">
                Deixe zero. Só use quando precisar que esta regra ganhe de outra.
              </p>
            </div>
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
              <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir regra" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Excluir a regra <strong>{confirmDel?.texto}</strong>? As compras já
            classificadas continuam como estão.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => excluir(confirmDel.id)} className="btn-danger flex-1">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
