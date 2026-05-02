import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit2, X, Check, Link, Unlink } from 'lucide-react';
import api from '../../services/api';
import { nomePerfil, nomeRole } from '../../utils/formatters';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-navy-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_USER = { nome: '', email: '', senha: '', perfil: 'admin_funcionario' };

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalVinculos, setModalVinculos] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [novoVinculo, setNovoVinculo] = useState({ tenantId: '', role: 1 });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        api.get('/users'),
        api.get('/tenants?limit=200'),
      ]);
      setUsuarios(usersRes.data.data?.users || []);
      setTenants(tenantsRes.data.data?.tenants || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setErro('');
    if (!form.nome || !form.email || !form.senha) {
      setErro('Nome, e-mail e senha são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', form);
      setModal(false);
      setForm(EMPTY_USER);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  async function adicionarVinculo(userId) {
    if (!novoVinculo.tenantId) return;
    try {
      await api.post('/users/vincular', {
        userId,
        role: novoVinculo.role,
        tenantId: novoVinculo.tenantId,
      });
      // Recarrega vínculos do usuário
      const { data } = await api.get(`/users/${userId}/vinculos`);
      const u = usuarios.find(u => u.id === userId);
      if (u) u.tenantRoles = data.data;
      setUsuarios([...usuarios]);
      setNovoVinculo({ tenantId: '', role: 1 });
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao vincular.');
    }
  }

  async function removerVinculo(userId, tenantId) {
    if (!confirm('Remover vínculo deste usuário com a empresa?')) return;
    try {
      await api.delete(`/users/vincular/${userId}?tenantId=${tenantId}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desvincular.');
    }
  }

  const usuarioVinculos = modalVinculos ? usuarios.find(u => u.id === modalVinculos) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{usuarios.length} usuário(s) da equipe Totali</p>
        <button onClick={() => { setErro(''); setForm(EMPTY_USER); setModal(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Usuário', 'Perfil', 'Empresas vinculadas', 'Ações'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                       text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4].map(j => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : usuarios.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center
                                    justify-center text-navy-700 text-xs font-semibold">
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-navy-800">{u.nome}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 bg-navy-100 text-navy-700 rounded
                                   text-xs font-medium">
                    {nomePerfil(u.perfil)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {u.tenantRoles?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.tenantRoles.slice(0, 3).map(r => (
                        <span key={r.id}
                          className="px-1.5 py-0.5 bg-slate-100 text-slate-600
                                     rounded text-[10px]">
                          {r.tenant?.razaoSocial?.substring(0, 20)}
                          {r.role && ` · Nível ${r.role}`}
                        </span>
                      ))}
                      {u.tenantRoles.length > 3 && (
                        <span className="text-xs text-slate-400">
                          +{u.tenantRoles.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Sem vínculos</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {u.perfil === 'admin_funcionario' && (
                    <button
                      onClick={() => { setNovoVinculo({ tenantId: '', role: 1 }); setModalVinculos(u.id); }}
                      className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-navy-50
                                 rounded transition-colors"
                      title="Gerenciar vínculos"
                    >
                      <Link size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal novo usuário */}
      <Modal open={modal} onClose={() => setModal(false)} title="Novo usuário Totali">
        <div className="space-y-4">
          <div>
            <label className="input-label">Nome completo *</label>
            <input className="input-field" value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className="input-label">E-mail *</label>
            <input type="email" className="input-field" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Senha provisória *</label>
            <input type="password" className="input-field" value={form.senha}
              onChange={e => setForm({ ...form, senha: e.target.value })}
              placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="input-label">Perfil</label>
            <select className="input-field" value={form.perfil}
              onChange={e => setForm({ ...form, perfil: e.target.value })}>
              <option value="admin_funcionario">Funcionário Totali</option>
              <option value="admin_total">Admin Total</option>
            </select>
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
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal vínculos */}
      <Modal open={!!modalVinculos} onClose={() => setModalVinculos(null)}
        title={`Vínculos — ${usuarioVinculos?.nome}`}>
        <div className="space-y-4">
          {/* Vínculos existentes */}
          <div className="space-y-2">
            {usuarioVinculos?.tenantRoles?.map(r => (
              <div key={r.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-navy-800">
                    {r.tenant?.razaoSocial}
                  </p>
                  <p className="text-xs text-slate-400">{nomeRole(r.role)}</p>
                </div>
                <button
                  onClick={() => removerVinculo(usuarioVinculos.id, r.tenant.id)}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <Unlink size={14} />
                </button>
              </div>
            ))}
            {!usuarioVinculos?.tenantRoles?.length && (
              <p className="text-sm text-slate-400 text-center py-3">
                Nenhum vínculo ativo
              </p>
            )}
          </div>

          {/* Adicionar vínculo */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Adicionar empresa</p>
            <div className="grid grid-cols-2 gap-2">
              <select className="input-field text-xs" value={novoVinculo.tenantId}
                onChange={e => setNovoVinculo({ ...novoVinculo, tenantId: e.target.value })}>
                <option value="">Selecionar...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.razaoSocial}</option>
                ))}
              </select>
              <select className="input-field text-xs" value={novoVinculo.role}
                onChange={e => setNovoVinculo({ ...novoVinculo, role: parseInt(e.target.value) })}>
                <option value={1}>Nível 1 — Gerencial</option>
                <option value={2}>Nível 2 — Operacional</option>
                <option value={3}>Nível 3 — Básico</option>
              </select>
            </div>
            <button
              onClick={() => adicionarVinculo(usuarioVinculos.id)}
              disabled={!novoVinculo.tenantId}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 text-xs">
              <Link size={13} /> Vincular
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
