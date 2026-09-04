import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Ban, ShieldCheck, Trash2, Check, RefreshCw, UserPlus,
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useRole from '../../hooks/useRole';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { nomeRole } from '../../utils/formatters';

/* Os três níveis de acesso dentro de uma empresa. A descrição é o que o
 * escritório lê na hora de vender o acesso — por isso fala de tela, e não
 * de permissão técnica. */
const NIVEIS = [
  { value: 1, label: 'Nível 1 — Gerencial',   ajuda: 'Vê tudo, configura a empresa e cadastra outros usuários.' },
  { value: 2, label: 'Nível 2 — Operacional', ajuda: 'Lança, importa OFX e concilia. Não mexe em configuração nem em usuários.' },
  { value: 3, label: 'Nível 3 — Básico',      ajuda: 'Consulta e lançamentos do dia a dia.' },
];

const EMPTY = { nome: '', email: '', senha: '', role: 2 };

/* Senha provisória fácil de ditar por telefone: sem caracteres que se
 * confundem na fala (l/1, O/0) e sem símbolo. O cliente troca depois. */
function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const maiusc = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const nums   = '23456789';
  const sorteia = (fonte, qtd) =>
    Array.from({ length: qtd }, () => fonte[Math.floor(Math.random() * fonte.length)]).join('');
  return `${sorteia(maiusc, 1)}${sorteia(letras, 5)}${sorteia(nums, 4)}`;
}

const PERFIS_TOTALI = ['admin_total', 'admin_funcionario'];

export default function UsuariosEmpresa() {
  const { tenant, user: usuarioLogado } = useAuthStore();
  const { isAdminTotal } = useRole();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState('');

  /* Preenchido quando o e-mail digitado já pertence a alguém do sistema:
   * o modal deixa de ser "novo usuário" e passa a oferecer acesso a esta
   * empresa. Só o Admin Total recebe do backend quem é a pessoa. */
  const [existente, setExistente] = useState(null);
  const [roleExistente, setRoleExistente] = useState(2);

  const [criado, setCriado] = useState(null); // credenciais recém-geradas

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroLista('');
    try {
      const { data } = await api.get(`/users?tenantId=${tenant?.id}`);
      setUsuarios(data.data?.users || []);
    } catch (err) {
      if (err?.response?.status !== 401) {
        setErroLista(err?.response?.data?.error || 'Erro ao carregar os usuários.');
      }
    }
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirModal() {
    setForm({ ...EMPTY, senha: gerarSenha() });
    setExistente(null);
    setCriado(null);
    setErro('');
    setModal(true);
  }

  function fecharModal() {
    setModal(false);
    setExistente(null);
    setCriado(null);
    setForm(EMPTY);
    setErro('');
  }

  async function salvar() {
    setErro('');
    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setErro('Nome, e-mail e senha provisória são obrigatórios.');
      return;
    }
    if (form.senha.length < 8) {
      setErro('A senha provisória precisa ter no mínimo 8 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', {
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        perfil: 'cliente',
        tenantId: tenant?.id,
        role: form.role,
      });
      // Guarda para exibir na tela: é a única vez que a senha aparece.
      setCriado({ nome: form.nome.trim(), email: form.email.trim().toLowerCase(), senha: form.senha });
      carregar();
    } catch (err) {
      const jaExiste = err.response?.data?.usuarioExistente;
      if (err.response?.status === 409 && jaExiste) {
        setExistente(jaExiste);
        setRoleExistente(form.role);
        setErro('');
      } else if (err.response?.status === 409) {
        setErro('Este e-mail já está cadastrado em outra empresa. Peça ao Admin Total para liberar o acesso aqui.');
      } else {
        setErro(err.response?.data?.error || 'Erro ao criar o usuário.');
      }
    }
    setSaving(false);
  }

  async function darAcessoExistente() {
    setSaving(true);
    setErro('');
    try {
      await api.post('/users/vincular', {
        userId: existente.id,
        role: roleExistente,
        tenantId: tenant?.id,
      });
      fecharModal();
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao liberar o acesso.');
    }
    setSaving(false);
  }

  async function alterarNivel(u, role) {
    try {
      await api.post('/users/vincular', { userId: u.id, role, tenantId: tenant?.id });
      setUsuarios(prev => prev.map(x => (x.id === u.id ? { ...x, role } : x)));
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar o nível de acesso.');
      carregar();
    }
  }

  async function alternarBloqueio(u) {
    const aviso = u.ativo
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

  async function removerDaEmpresa(u) {
    if (!confirm(
      `Remover ${u.nome} desta empresa? O cadastro continua existindo, mas a pessoa `
      + `deixa de ver os dados de ${tenant?.nomeFantasia || tenant?.razaoSocial}.`
    )) return;
    try {
      await api.delete(`/users/vincular/${u.id}?tenantId=${tenant?.id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover o usuário da empresa.');
    }
  }

  /* Equipe da Totali vinculada à empresa aparece na lista, mas só o Admin
   * Total mexe nela — um gerente do cliente não administra o escritório. */
  function podeMexer(u) {
    if (u.id === usuarioLogado?.id) return false;
    if (PERFIS_TOTALI.includes(u.perfil)) return isAdminTotal;
    return true;
  }

  const clientes = usuarios.filter(u => !PERFIS_TOTALI.includes(u.perfil));

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-navy-800 text-lg">Usuários</h2>
          <p className="text-sm text-slate-400">
            Quem tem acesso a {tenant?.nomeFantasia || tenant?.razaoSocial || 'esta empresa'}
            {' · '}
            {clientes.length} usuário{clientes.length !== 1 ? 's' : ''} do cliente
          </p>
        </div>
        <button onClick={abrirModal} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {erroLista && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {erroLista}
        </div>
      )}

      {/* Lista */}
      <div className="card overflow-hidden">
        {!loading && usuarios.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário com acesso"
            description="Crie o login do cliente para ele começar a usar o sistema."
            action={
              <button onClick={abrirModal} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Novo usuário
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Usuário', 'Nível de acesso', 'Situação', 'Ações'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold
                                           text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
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
                          {u.nome?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-navy-800 flex items-center gap-2">
                            {u.nome}
                            {PERFIS_TOTALI.includes(u.perfil) && (
                              <span className="px-1.5 py-0.5 bg-gold-100 text-gold-700
                                               rounded text-[10px] font-medium">
                                Equipe Totali
                              </span>
                            )}
                            {u.id === usuarioLogado?.id && (
                              <span className="text-[10px] text-slate-400">(você)</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {podeMexer(u) && !PERFIS_TOTALI.includes(u.perfil) ? (
                        <select
                          className="input-field text-xs py-1.5"
                          value={u.role || 3}
                          onChange={e => alterarNivel(u, parseInt(e.target.value))}
                        >
                          {NIVEIS.map(n => (
                            <option key={n.value} value={n.value}>{n.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {u.role ? nomeRole(u.role) : 'Acesso do escritório'}
                        </span>
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
                        {podeMexer(u) && (
                          <>
                            <button
                              onClick={() => alternarBloqueio(u)}
                              className={`p-1.5 rounded transition-colors ${
                                u.ativo === false
                                  ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              }`}
                              title={u.ativo === false ? 'Liberar acesso' : 'Bloquear acesso'}
                            >
                              {u.ativo === false ? <ShieldCheck size={14} /> : <Ban size={14} />}
                            </button>
                            <button
                              onClick={() => removerDaEmpresa(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600
                                         hover:bg-red-50 rounded transition-colors"
                              title="Remover desta empresa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modal}
        onClose={fecharModal}
        title={criado ? 'Acesso criado' : existente ? 'E-mail já cadastrado' : 'Novo usuário'}
      >
        {criado ? (
          /* A senha só aparece aqui — depois disso nem o sistema a mostra. */
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800
                            text-sm px-4 py-3 rounded-lg">
              Acesso criado. Passe estes dados ao cliente e peça para ele trocar a senha
              no primeiro acesso, em "Esqueci minha senha".
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-slate-500">Nome:</span> <strong>{criado.nome}</strong></p>
              <p><span className="text-slate-500">E-mail (login):</span> <strong>{criado.email}</strong></p>
              <p><span className="text-slate-500">Senha provisória:</span>{' '}
                <strong className="font-mono">{criado.senha}</strong></p>
            </div>
            <button onClick={fecharModal} className="btn-primary w-full">Concluir</button>
          </div>
        ) : existente ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-800
                            text-sm px-4 py-3 rounded-lg">
              <strong>{existente.nome}</strong> ({existente.email}) já tem cadastro no sistema.
              Em vez de criar outro login, libere o acesso desta pessoa a esta empresa.
            </div>
            <div>
              <label className="input-label">Nível de acesso nesta empresa</label>
              <select
                className="input-field"
                value={roleExistente}
                onChange={e => setRoleExistente(parseInt(e.target.value))}
              >
                {NIVEIS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {NIVEIS.find(n => n.value === roleExistente)?.ajuda}
              </p>
            </div>
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                              px-4 py-3 rounded-lg">{erro}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={darAcessoExistente} disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <UserPlus size={15} />}
                Liberar acesso
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="input-label">Nome completo *</label>
              <input className="input-field" placeholder="Nome de quem vai usar o sistema"
                value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label className="input-label">E-mail *</label>
              <input type="email" className="input-field" placeholder="email@empresa.com.br"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">É com este e-mail que a pessoa entra no sistema.</p>
            </div>
            <div>
              <label className="input-label">Senha provisória *</label>
              <div className="flex gap-2">
                <input className="input-field flex-1 font-mono" value={form.senha}
                  onChange={e => setForm({ ...form, senha: e.target.value })}
                  placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setForm({ ...form, senha: gerarSenha() })}
                  className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
                  title="Gerar outra senha">
                  <RefreshCw size={14} /> Gerar
                </button>
              </div>
            </div>
            <div>
              <label className="input-label">Nível de acesso *</label>
              <select className="input-field" value={form.role}
                onChange={e => setForm({ ...form, role: parseInt(e.target.value) })}>
                {NIVEIS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {NIVEIS.find(n => n.value === form.role)?.ajuda}
              </p>
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
                Criar acesso
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
