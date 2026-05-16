import { useState, useEffect, useCallback } from 'react';
import { Tags, Plus, Edit2, ToggleLeft, ToggleRight, Check, Package, Info } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';

const TIPOS = [
  { value: 'receita', label: 'Receita', cor: 'bg-emerald-100 text-emerald-700' },
  { value: 'despesa', label: 'Despesa', cor: 'bg-red-100 text-red-700' },
  { value: 'transferencia', label: 'Transferência', cor: 'bg-blue-100 text-blue-700' },
];

const NATUREZAS = [
  { value: 'fixa', label: 'Fixa' },
  { value: 'variavel', label: 'Variável' },
];

const SUBTIPOS_DESPESA = [
  { value: 'operacional', label: 'Operacional', cor: 'bg-red-50 border-red-300 text-red-700' },
  { value: 'distribuicao_lucros', label: 'Distribuição de Lucros', cor: 'bg-amber-50 border-amber-300 text-amber-700' },
];

const EMPTY = {
  nome: '', tipo: 'despesa', natureza: 'variavel', subtipo: 'operacional',
  contaDebito: '', contaCredito: '', codHistorico: '',
  centroCustoD: '', centroCustoC: '', flagMercadoria: false,
};

function TipoBadge({ tipo }) {
  const t = TIPOS.find(x => x.value === tipo);
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                      tracking-wide ${t?.cor}`}>
      {t?.label}
    </span>
  );
}

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [abaDominio, setAbaDominio] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      params.set('ativo', 'true');
      const { data } = await api.get(`/categories?${params}`);
      setCategorias(data.data || []);
    } catch (_) {}
    setLoading(false);
  }, [filtroTipo]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal(cat = null) {
    setErro('');
    setAbaDominio(false);
    if (cat) {
      setEditando(cat);
      setForm({
        nome: cat.nome,
        tipo: cat.tipo,
        natureza: cat.natureza,
        subtipo: cat.subtipo || 'operacional',
        contaDebito: cat.contaDebito || '',
        contaCredito: cat.contaCredito || '',
        codHistorico: cat.codHistorico || '',
        centroCustoD: cat.centroCustoD || '',
        centroCustoC: cat.centroCustoC || '',
        flagMercadoria: cat.flagMercadoria || false,
      });
    } else {
      setEditando(null);
      setForm(EMPTY);
    }
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/categories/${editando.id}`, form);
      } else {
        await api.post('/categories', form);
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function toggleAtivo(cat) {
    try {
      await api.patch(`/categories/${cat.id}/toggle`);
      carregar();
    } catch (_) {}
  }

  // Subdivide despesas em "operacional" e "distribuicao_lucros" pra separar
  // visualmente — distribuição de lucros não é despesa operacional do DRE.
  const grouped = [
    { value: 'receita', tipoBase: 'receita', label: 'Receita',
      cor: 'bg-emerald-100 text-emerald-700',
      items: categorias.filter(c => c.tipo === 'receita') },
    { value: 'despesa-operacional', tipoBase: 'despesa', label: 'Despesas Operacionais',
      cor: 'bg-red-100 text-red-700',
      items: categorias.filter(c => c.tipo === 'despesa' && (c.subtipo || 'operacional') === 'operacional') },
    { value: 'despesa-distribuicao', tipoBase: 'despesa', label: 'Distribuição de Lucros',
      cor: 'bg-amber-100 text-amber-700',
      items: categorias.filter(c => c.tipo === 'despesa' && c.subtipo === 'distribuicao_lucros') },
    { value: 'transferencia', tipoBase: 'transferencia', label: 'Transferência',
      cor: 'bg-blue-100 text-blue-700',
      items: categorias.filter(c => c.tipo === 'transferencia') },
  ].filter(g => !filtroTipo || g.tipoBase === filtroTipo);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Categorias</h2>
          <p className="text-sm text-slate-400">Plano de contas com códigos Domínio Contábil</p>
        </div>
        <div className="flex gap-2">
          {/* Filtro de tipo */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">
            {[{ value: '', label: 'Todas' }, ...TIPOS].map(t => (
              <button
                key={t.value}
                onClick={() => setFiltroTipo(t.value)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  filtroTipo === t.value
                    ? 'bg-white text-navy-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Nova categoria
          </button>
        </div>
      </div>

      {/* Grupos por tipo */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-24" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : categorias.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar seus lançamentos e configurar os códigos do Domínio Contábil."
            action={
              <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Criar primeira categoria
              </button>
            }
          />
        </div>
      ) : (
        grouped.map(grupo => grupo.items.length > 0 && (
          <div key={grupo.value} className="card overflow-hidden">
            {/* Header do grupo */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase
                               tracking-wide ${grupo.cor}`}>
                {grupo.label}
              </span>
              <span className="text-xs text-slate-400">{grupo.items.length} categoria{grupo.items.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Tabela */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400">Nome</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Natureza</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Cto. Débito</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Cto. Crédito</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Cód. Hist.</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grupo.items.map(cat => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-navy-800">{cat.nome}</span>
                        {cat.flagMercadoria && (
                          <span title="Compra de mercadorias (impacta CMV)"
                            className="w-4 h-4 bg-amber-100 text-amber-600 rounded
                                       flex items-center justify-center flex-shrink-0">
                            <Package size={10} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        cat.natureza === 'fixa'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cat.natureza === 'fixa' ? 'Fixa' : 'Variável'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {cat.contaDebito || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {cat.contaCredito || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {cat.codHistorico || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => abrirModal(cat)}
                          className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50
                                     rounded transition-colors" title="Editar">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => toggleAtivo(cat)}
                          className="p-1.5 text-slate-400 hover:text-slate-600
                                     hover:bg-slate-100 rounded transition-colors"
                          title={cat.ativo ? 'Desativar' : 'Ativar'}>
                          {cat.ativo
                            ? <ToggleRight size={15} className="text-emerald-500" />
                            : <ToggleLeft size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Modal Criar/Editar */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar categoria' : 'Nova categoria'}
        size="lg"
      >
        {/* Abas */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 mb-5">
          {[
            { id: false, label: 'Dados gerais' },
            { id: true, label: 'Domínio Contábil' },
          ].map(aba => (
            <button
              key={String(aba.id)}
              onClick={() => setAbaDominio(aba.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                abaDominio === aba.id
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {!abaDominio ? (
            /* Aba dados gerais */
            <>
              <div>
                <label className="input-label">Nome da categoria *</label>
                <input className="input-field" placeholder="Ex: Aluguel"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Tipo *</label>
                  <select className="input-field" value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Natureza *</label>
                  <select className="input-field" value={form.natureza}
                    onChange={e => setForm({ ...form, natureza: e.target.value })}>
                    {NATUREZAS.map(n => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.tipo === 'despesa' && (
                <div>
                  <label className="input-label">Classificação</label>
                  <div className="flex gap-2">
                    {SUBTIPOS_DESPESA.map(st => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => setForm({ ...form, subtipo: st.value })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          (form.subtipo || 'operacional') === st.value
                            ? st.cor
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    "Distribuição de Lucros" não compõe o total de despesas no dashboard nem o DRE como despesa operacional.
                  </p>
                </div>
              )}
              {form.tipo === 'despesa' && (
                <label className="flex items-start gap-3 p-3 bg-amber-50 border
                                  border-amber-100 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-amber-500"
                    checked={form.flagMercadoria}
                    onChange={e => setForm({ ...form, flagMercadoria: e.target.checked })}
                  />
                  <div>
                    <p className="text-sm font-medium text-amber-800 flex items-center gap-1">
                      <Package size={13} /> Compra de Mercadorias
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Lançamentos nesta categoria serão contabilizados como compras
                      e impactarão o cálculo do CMV na DRE.
                    </p>
                  </div>
                </label>
              )}
            </>
          ) : (
            /* Aba Domínio Contábil */
            <>
              <div className="flex items-start gap-2 p-3 bg-navy-50 border border-navy-100
                              rounded-xl mb-2">
                <Info size={14} className="text-navy-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-navy-700">
                  Estes campos são usados na exportação para o Domínio Contábil.
                  Os valores aqui são aplicados automaticamente nos lançamentos,
                  mas podem ser alterados manualmente em cada lançamento.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Conta Débito</label>
                  <input className="input-field font-mono" placeholder="Ex: 245"
                    value={form.contaDebito}
                    onChange={e => setForm({ ...form, contaDebito: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Conta Crédito</label>
                  <input className="input-field font-mono" placeholder="Ex: 15"
                    value={form.contaCredito}
                    onChange={e => setForm({ ...form, contaCredito: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label">Cód. Histórico Padrão</label>
                <input className="input-field font-mono" placeholder="Ex: 10"
                  value={form.codHistorico}
                  onChange={e => setForm({ ...form, codHistorico: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Centro de Custo Débito</label>
                  <input className="input-field font-mono" placeholder="Opcional"
                    value={form.centroCustoD}
                    onChange={e => setForm({ ...form, centroCustoD: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Centro de Custo Crédito</label>
                  <input className="input-field font-mono" placeholder="Opcional"
                    value={form.centroCustoC}
                    onChange={e => setForm({ ...form, centroCustoC: e.target.value })} />
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-medium mb-1">
                  Prévia da linha exportada
                </p>
                <p className="font-mono text-[11px] text-slate-600 break-all">
                  DD/MM/AAAA;
                  <span className="text-navy-700">{form.contaDebito || '___'}</span>;
                  <span className="text-navy-700">{form.contaCredito || '___'}</span>;
                  Valor;
                  <span className="text-navy-700">{form.codHistorico || '___'}</span>;
                  Complemento;Filial;
                  <span className="text-navy-700">{form.centroCustoD || ''}</span>;
                  <span className="text-navy-700">{form.centroCustoC || ''}</span>
                </p>
              </div>
            </>
          )}

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
    </div>
  );
}
