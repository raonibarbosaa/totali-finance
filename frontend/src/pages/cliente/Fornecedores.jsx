// frontend/src/pages/cliente/Fornecedores.jsx
// Etapa 4.2 - CRUD de fornecedores (escopo do tenant).
// Padrão visual: alinhado com Categorias.jsx / outras telas de cadastro.

import { useEffect, useState } from 'react';
import api from '../../services/api';

const TIPO_DOC_OPCOES = [
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cpf',  label: 'CPF' },
];

const formVazio = {
  nome:          '',
  tipoDocumento: 'cnpj',
  documento:     '',
  email:         '',
  telefone:      '',
  observacao:    '',
};

export default function Fornecedores() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca,   setBusca]   = useState('');
  const [modal,   setModal]   = useState({ open: false, editando: null });

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get('/suppliers');
      const lista = Array.isArray(r.data?.data) ? r.data.data : [];
      setItems(lista);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function excluir(id, nome) {
    if (!confirm(`Excluir fornecedor "${nome}"?\n\nFornecedores com títulos lançados serão apenas inativados.`)) return;
    try {
      await api.delete(`/suppliers/${id}`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  const filtrados = items.filter((it) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [it.nome, it.documento, it.email, it.telefone]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Fornecedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cadastro de fornecedores para vincular aos títulos a pagar
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, editando: null })}
          className="px-4 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors"
        >
          + Novo Fornecedor
        </button>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ/CPF, email ou telefone..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th>Nome</Th>
              <Th>Documento</Th>
              <Th>Email</Th>
              <Th>Telefone</Th>
              <Th className="text-right pr-6">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                {busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
              </td></tr>
            ) : (
              filtrados.map((it) => (
                <tr key={it.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>
                    <div className="font-medium text-gray-900">{it.nome}</div>
                    {it.observacao && <div className="text-xs text-gray-400 truncate max-w-xs">{it.observacao}</div>}
                  </Td>
                  <Td>
                    {it.documento ? (
                      <span>
                        <span className="text-xs uppercase text-gray-400 mr-1">{it.tipoDocumento}</span>
                        {it.documento}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td>{it.email || <span className="text-gray-300">—</span>}</Td>
                  <Td>{it.telefone || <span className="text-gray-300">—</span>}</Td>
                  <Td className="text-right pr-6">
                    <button
                      onClick={() => setModal({ open: true, editando: it })}
                      className="text-[#152740] hover:underline text-sm mr-3"
                    >Editar</button>
                    <button
                      onClick={() => excluir(it.id, it.nome)}
                      className="text-red-600 hover:underline text-sm"
                    >Excluir</button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <FornecedorModal
          editando={modal.editando}
          onClose={() => setModal({ open: false, editando: null })}
          onSaved={() => { setModal({ open: false, editando: null }); carregar(); }}
        />
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = '' }) {
  return <td className={`px-6 py-3 text-gray-700 ${className}`}>{children}</td>;
}

// ─── Modal ─────────────────────────────────────────────────────────────

function FornecedorModal({ editando, onClose, onSaved }) {
  const [form,    setForm]    = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro,    setErro]    = useState('');

  useEffect(() => {
    if (editando) {
      setForm({
        nome:          editando.nome          || '',
        tipoDocumento: editando.tipoDocumento || 'cnpj',
        documento:     editando.documento     || '',
        email:         editando.email         || '',
        telefone:      editando.telefone      || '',
        observacao:    editando.observacao    || '',
      });
    } else {
      setForm(formVazio);
    }
    setErro('');
  }, [editando]);

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      if (!form.nome.trim()) throw new Error('Nome é obrigatório');
      if (editando) {
        await api.put(`/suppliers/${editando.id}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      onSaved();
    } catch (e) {
      setErro(e.response?.data?.error || e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#152740]">
            {editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <Field label="Nome" required>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <select
                value={form.tipoDocumento}
                onChange={(e) => set('tipoDocumento', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              >
                {TIPO_DOC_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="CNPJ / CPF">
                <input
                  type="text"
                  value={form.documento}
                  onChange={(e) => set('documento', e.target.value)}
                  placeholder={form.tipoDocumento === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
            <Field label="Telefone">
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
          </div>

          <Field label="Observação">
            <textarea
              rows={3}
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740] resize-none"
            />
          </Field>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
