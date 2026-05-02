import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Edit2, Trash2, Check, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY = { textoHistorico: '', categoryId: '', complementoAuto: '' };

export default function PadroesOFX() {
  const [padroes, setPadroes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [padRes, catRes] = await Promise.all([
        api.get('/ofx-patterns'),
        api.get('/categories?ativo=true'),
      ]);
      setPadroes(padRes.data.data || []);
      setCategorias(catRes.data.data || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal(p = null) {
    setErro('');
    if (p) {
      setEditando(p);
      setForm({
        textoHistorico: p.textoHistorico,
        categoryId: p.categoryId,
        complementoAuto: p.complementoAuto || '',
      });
    } else {
      setEditando(null);
      setForm(EMPTY);
    }
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.textoHistorico.trim() || !form.categoryId) {
      setErro('Texto do histórico e categoria são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/ofx-patterns/${editando.id}`, form);
      } else {
        await api.post('/ofx-patterns', form);
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function remover(id) {
    if (!confirm('Remover este padrão OFX?')) return;
    try {
      await api.delete(`/ofx-patterns/${id}`);
      carregar();
    } catch (_) {}
  }

  const catPorTipo = {
    receita: categorias.filter(c => c.tipo === 'receita'),
    despesa: categorias.filter(c => c.tipo === 'despesa'),
    transferencia: categorias.filter(c => c.tipo === 'transferencia'),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Padrões OFX</h2>
          <p className="text-sm text-slate-400">
            De-Para automático: histórico bancário → categoria
          </p>
        </div>
        <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo padrão
        </button>
      </div>

      {/* Explicação */}
      <div className="card p-4 bg-navy-50 border-navy-100">
        <p className="text-sm text-navy-800 font-medium mb-1">Como funciona</p>
        <p className="text-xs text-navy-600 leading-relaxed">
          Ao importar um arquivo OFX, o sistema verifica se o histórico da transação
          bancária <strong>contém</strong> o texto cadastrado aqui. Se sim, a categoria
          é aplicada automaticamente, agilizando a conciliação.
        </p>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card divide-y divide-slate-50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-4">
              <div className="flex-1 h-4 bg-slate-100 rounded" />
              <div className="w-4 h-4 bg-slate-100 rounded" />
              <div className="w-32 h-4 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : padroes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GitBranch}
            title="Nenhum padrão cadastrado"
            description="Crie padrões para que o sistema categorize automaticamente as transações importadas do OFX."
            action={
              <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Criar padrão
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500
                               uppercase tracking-wide">Texto do histórico bancário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500
                               uppercase tracking-wide w-6" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500
                               uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500
                               uppercase tracking-wide">Complemento automático</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {padroes.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm bg-slate-100 text-slate-700
                                     px-2 py-0.5 rounded">
                      {p.textoHistorico}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-300">
                    <ArrowRight size={14} />
                  </td>
                  <td className="px-4 py-3">
                    {p.category && (
                      <div>
                        <p className="font-medium text-navy-800">{p.category.nome}</p>
                        <p className="text-xs text-slate-400 capitalize">{p.category.tipo}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {p.complementoAuto || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => abrirModal(p)}
                        className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50
                                   rounded transition-colors" title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => remover(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50
                                   rounded transition-colors" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editando ? 'Editar padrão OFX' : 'Novo padrão OFX'} size="md">
        <div className="space-y-4">
          <div>
            <label className="input-label">Texto do histórico bancário *</label>
            <input
              className="input-field font-mono"
              placeholder="Ex: PGTO FORN, SALARIO, ENERGIA"
              value={form.textoHistorico}
              onChange={e => setForm({ ...form, textoHistorico: e.target.value.toUpperCase() })}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              O sistema verifica se este texto está <em>contido</em> no histórico da transação (case-insensitive).
            </p>
          </div>

          <div>
            <label className="input-label">Categoria *</label>
            <select className="input-field" value={form.categoryId}
              onChange={e => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Selecionar categoria...</option>
              {Object.entries(catPorTipo).map(([tipo, cats]) =>
                cats.length > 0 && (
                  <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                    {cats.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </optgroup>
                )
              )}
            </select>
          </div>

          <div>
            <label className="input-label">Complemento automático</label>
            <input
              className="input-field"
              placeholder="Ex: PAGAMENTO DE FORNECEDOR"
              value={form.complementoAuto}
              onChange={e => setForm({ ...form, complementoAuto: e.target.value })}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Texto que será preenchido automaticamente no campo "Complemento" do lançamento.
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                            px-4 py-3 rounded-lg">{erro}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
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
    </div>
  );
}
