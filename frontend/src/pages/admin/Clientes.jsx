import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Search, Edit2, ToggleLeft,
  ToggleRight, ChevronRight, X, Check
} from 'lucide-react';
import api from '../../services/api';
import { formatCNPJ, maskCNPJ } from '../../utils/formatters';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md
                      animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-navy-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  razaoSocial: '', nomeFantasia: '', cnpj: '',
  codigoFilial: '', regime: 'caixa',
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const LIMIT = 20;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tenants', {
        params: { page, limit: LIMIT, search },
      });
      setClientes(data.data.tenants);
      setTotal(data.data.total);
    } catch (_) {}
    setLoading(false);
  }, [page, search]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal(cliente = null) {
    setErro('');
    if (cliente) {
      setEditando(cliente);
      setForm({
        razaoSocial: cliente.razaoSocial,
        nomeFantasia: cliente.nomeFantasia || '',
        cnpj: cliente.cnpj,
        codigoFilial: cliente.codigoFilial || '',
        regime: cliente.regime,
      });
    } else {
      setEditando(null);
      setForm(EMPTY_FORM);
    }
    setModal(true);
  }

  async function salvar() {
    setErro('');
    if (!form.razaoSocial.trim() || !form.cnpj.trim()) {
      setErro('Razão social e CNPJ são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/tenants/${editando.id}`, form);
      } else {
        await api.post('/tenants', form);
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function toggleStatus(cliente) {
    try {
      await api.patch(`/tenants/${cliente.id}/status`, { ativo: !cliente.ativo });
      carregar();
    } catch (_) {}
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo cliente
        </button>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Empresa
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  CNPJ
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Regime
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Cód. Filial
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Nenhum cliente encontrado.</p>
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-800">
                        {c.nomeFantasia || c.razaoSocial}
                      </p>
                      {c.nomeFantasia && (
                        <p className="text-xs text-slate-400">{c.razaoSocial}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatCNPJ(c.cnpj)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.regime === 'competencia'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {c.regime === 'competencia' ? 'Competência' : 'Caixa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.codigoFilial || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`flex items-center gap-1.5 text-xs font-medium
                          ${c.ativo ? 'text-emerald-600' : 'text-slate-400'}`}
                      >
                        {c.ativo
                          ? <ToggleRight size={18} className="text-emerald-500" />
                          : <ToggleLeft size={18} />}
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => abrirModal(c)}
                        className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50
                                   rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {total} clientes · página {page} de {pages}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs rounded border border-slate-200
                           disabled:opacity-40 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs rounded border border-slate-200
                           disabled:opacity-40 hover:bg-slate-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal novo/editar cliente */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar cliente' : 'Novo cliente'}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Razão Social *</label>
            <input
              className="input-field"
              value={form.razaoSocial}
              onChange={e => setForm({ ...form, razaoSocial: e.target.value })}
              placeholder="Nome completo da empresa"
            />
          </div>
          <div>
            <label className="input-label">Nome Fantasia</label>
            <input
              className="input-field"
              value={form.nomeFantasia}
              onChange={e => setForm({ ...form, nomeFantasia: e.target.value })}
              placeholder="Como é conhecido"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">CNPJ *</label>
              <input
                className="input-field"
                value={form.cnpj}
                onChange={e => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <label className="input-label">Cód. Filial (Domínio)</label>
              <input
                className="input-field"
                value={form.codigoFilial}
                onChange={e => setForm({ ...form, codigoFilial: e.target.value })}
                placeholder="Ex: 1"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Regime Contábil</label>
            <select
              className="input-field"
              value={form.regime}
              onChange={e => setForm({ ...form, regime: e.target.value })}
            >
              <option value="caixa">Regime de Caixa</option>
              <option value="competencia">Regime de Competência</option>
            </select>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                            px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                 rounded-full animate-spin" />
              ) : <Check size={15} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
