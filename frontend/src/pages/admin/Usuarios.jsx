import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit2, X, Check, Link, Unlink, Ban, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { nomePerfil, nomeRole } from '../../utils/formatters';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',boxSizing:'border-box'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)'}} onClick={onClose} />
      <div style={{position:'relative',background:'white',borderRadius:'16px',boxShadow:'0 25px 50px rgba(0,0,0,0.25)',width:'100%',maxWidth:'480px',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
          <h3 style={{fontWeight:600,color:'#1e293b',margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'20px',lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:'20px 24px',overflowY:'auto',flex:1}}>{children}</div>
      </div>
    </div>
  );
}

const EMPTY_USER = { nome: '', email: '', senha: '', perfil: 'admin_funcionario' };

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [modal, setModal] = useState(false);
  const [modalVinculos, setModalVinculos] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [novoVinculo, setNovoVinculo] = useState({ tenantId: '', role: 1 });
  // Preenchido quando o e-mail digitado já pertence a alguém: o modal deixa de
  // ser "novo usuário" e passa a oferecer acesso a mais uma empresa.
  const [existente, setExistente] = useState(null);
  const [vinculoExistente, setVinculoExistente] = useState({ tenantId: '', role: 1 });

  const { user: usuarioLogado } = useAuthStore();

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroLista('');
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        api.get('/users?escopo=equipe'),
        api.get('/tenants?limit=200'),
      ]);
      setUsuarios(usersRes.data.data?.users || []);
      setTenants(tenantsRes.data.data?.tenants || []);
    } catch (err) {
      // 401 já é tratado globalmente pelo interceptor do api.js (logout + redirect).
      // Aqui só exibimos mensagem para outros erros (rede, 500, 403, etc.).
      if (err?.response?.status !== 401) {
        const msg = err?.response?.data?.error
          || err?.message
          || 'Erro ao carregar usuários.';
        setErroLista(msg);
        // eslint-disable-next-line no-console
        console.error('[AdminUsuarios] erro ao carregar:', err);
      }
    }
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
      const jaExiste = err.response?.data?.usuarioExistente;
      if (err.response?.status === 409 && jaExiste) {
        setExistente(jaExiste);
        setVinculoExistente({ tenantId: '', role: 1 });
        setErro('');
      } else {
        setErro(err.response?.data?.error || 'Erro ao salvar.');
      }
    }
    setSaving(false);
  }

  function fecharModal() {
    setModal(false);
    setExistente(null);
    setForm(EMPTY_USER);
    setErro('');
  }

  async function darAcessoExistente() {
    if (!vinculoExistente.tenantId) {
      setErro('Selecione a empresa.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      await api.post('/users/vincular', {
        userId: existente.id,
        role: vinculoExistente.role,
        tenantId: vinculoExistente.tenantId,
      });
      fecharModal();
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao dar acesso.');
    }
    setSaving(false);
  }

  async function alternarBloqueio(u) {
    const vaiBloquear = u.ativo;
    const aviso = vaiBloquear
      ? `Bloquear ${u.nome}? A pessoa é desconectada na hora e não consegue mais entrar.`
      : `Liberar novamente o acesso de ${u.nome}?`;
    if (!confirm(aviso)) return;

    try {
      await api.put(`/users/${u.id}`, { ativo: !u.ativo });
      carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar o acesso.');
    }
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

  // Não oferecer empresa que a pessoa já acessa
  const tenantsDisponiveis = existente
    ? tenants.filter(t => !existente.tenantRoles?.some(r => r.tenant?.id === t.id))
    : tenants;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{usuarios.length} usuário(s) da equipe Totali</p>
        <button onClick={() => { setErro(''); setForm(EMPTY_USER); setExistente(null); setModal(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {erroLista && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                        px-4 py-3 rounded-lg">
          {erroLista}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Usuário', 'Perfil', 'Empresas vinculadas', 'Situação', 'Ações'].map(h => (
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
                  {[1, 2, 3, 4, 5].map(j => (
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
                  ) : u.perfil === 'admin_total' ? (
                    // Admin Total enxerga todas as empresas por definição, sem
                    // precisar de vínculo — "Sem vínculos" dava a impressão
                    // errada de que a pessoa não acessava nada.
                    <span className="text-xs text-navy-600 font-medium">Todas as empresas</span>
                  ) : (
                    <span className="text-xs text-slate-400">Sem vínculos</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {u.ativo === false ? (
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded
                                     text-xs font-medium">Bloqueado</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded
                                     text-xs font-medium">Ativo</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
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

                    {u.id !== usuarioLogado?.id && (
                      <button
                        onClick={() => alternarBloqueio(u)}
                        className={`p-1.5 rounded transition-colors ${
                          u.ativo === false
                            ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={u.ativo === false ? 'Desbloquear acesso' : 'Bloquear acesso'}
                      >
                        {u.ativo === false ? <ShieldCheck size={14} /> : <Ban size={14} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal novo usuário — vira convite de vínculo se o e-mail já existir */}
      <Modal
        open={modal}
        onClose={fecharModal}
        title={existente ? 'Este e-mail já tem cadastro' : 'Novo usuário Totali'}
      >
        {existente ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-900">
                <strong>{existente.nome}</strong> já usa o e-mail{' '}
                <span className="font-medium">{existente.email}</span>.
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Em vez de criar outro cadastro, dê a esta pessoa acesso a mais uma empresa —
                ela entra com a mesma senha de sempre.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Acessos que já tem</p>
              {existente.tenantRoles?.length ? (
                <div className="space-y-1.5">
                  {existente.tenantRoles.map(r => (
                    <div key={r.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <p className="text-sm text-navy-800">
                        {r.tenant?.nomeFantasia || r.tenant?.razaoSocial}
                      </p>
                      <span className="text-xs text-slate-400">{nomeRole(r.role)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nenhuma empresa vinculada ainda.</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Dar acesso a mais uma empresa</p>
              {tenantsDisponiveis.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Esta pessoa já tem acesso a todas as empresas cadastradas.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select className="input-field text-xs" value={vinculoExistente.tenantId}
                    onChange={e => setVinculoExistente({ ...vinculoExistente, tenantId: e.target.value })}>
                    <option value="">Selecionar empresa...</option>
                    {tenantsDisponiveis.map(t => (
                      <option key={t.id} value={t.id}>{t.razaoSocial}</option>
                    ))}
                  </select>
                  <select className="input-field text-xs" value={vinculoExistente.role}
                    onChange={e => setVinculoExistente({ ...vinculoExistente, role: parseInt(e.target.value) })}>
                    <option value={1}>Nível 1 — Gerencial</option>
                    <option value={2}>Nível 2 — Operacional</option>
                    <option value={3}>Nível 3 — Básico</option>
                  </select>
                </div>
              )}
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                              px-4 py-3 rounded-lg">{erro}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={darAcessoExistente}
                disabled={saving || !vinculoExistente.tenantId}
                className="btn-primary flex-1 flex items-center justify-center gap-2
                           disabled:opacity-60 disabled:cursor-not-allowed">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Link size={15} />}
                Dar acesso
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="input-label">Nome completo *</label>
              <input className="input-field" placeholder="Nome do usuário" value={form.nome}
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
              <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={salvar} disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={15} />}
                Salvar
              </button>
            </div>
          </div>
        )}
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
