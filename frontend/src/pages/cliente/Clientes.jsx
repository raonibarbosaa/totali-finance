// frontend/src/pages/cliente/Clientes.jsx
// Etapa 4.2 - CRUD de clientes (escopo do tenant).
// Etapa 4A - importação em massa via planilha + campos extras
//            (pessoaContato, emailsAdicionais, endereço estruturado,
//             inscrições estadual/municipal).

import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const TIPO_DOC_OPCOES = [
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cpf',  label: 'CPF' },
];

const formVazio = {
  nome:               '',
  tipoDocumento:      'cnpj',
  documento:          '',
  email:              '',
  telefone:           '',
  pessoaContato:      '',
  emailsAdicionais:   '',
  cep:                '',
  logradouro:         '',
  numero:             '',
  complemento:        '',
  bairro:             '',
  cidade:             '',
  uf:                 '',
  inscricaoEstadual:  '',
  inscricaoMunicipal: '',
  endereco:           '',
  observacao:         '',
};

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]';

export default function Clientes() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busca,      setBusca]      = useState('');
  const [modal,      setModal]      = useState({ open: false, editando: null });
  const [importOpen, setImportOpen] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get('/customers');
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
    if (!confirm(`Excluir cliente "${nome}"?\n\nClientes com títulos lançados serão apenas inativados.`)) return;
    try {
      await api.delete(`/customers/${id}`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  const filtrados = items.filter((it) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [it.nome, it.documento, it.email, it.telefone, it.pessoaContato]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cadastro de clientes para vincular aos títulos a receber
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="px-4 py-2 border border-gray-300 text-[#152740] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Importar planilha
          </button>
          <button
            onClick={() => setModal({ open: true, editando: null })}
            className="px-4 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors"
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ/CPF, email, telefone ou contato..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th>Nome</Th>
              <Th>Documento</Th>
              <Th>Contato</Th>
              <Th>Telefone</Th>
              <Th className="text-right pr-6">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </td></tr>
            ) : (
              filtrados.map((it) => (
                <tr key={it.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>
                    <div className="font-medium text-gray-900">{it.nome}</div>
                    {it.email && <div className="text-xs text-gray-500 truncate max-w-xs">{it.email}</div>}
                  </Td>
                  <Td>
                    {it.documento ? (
                      <span>
                        <span className="text-xs uppercase text-gray-400 mr-1">{it.tipoDocumento}</span>
                        {it.documento}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td>{it.pessoaContato || <span className="text-gray-300">—</span>}</Td>
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
        <ClienteModal
          editando={modal.editando}
          onClose={() => setModal({ open: false, editando: null })}
          onSaved={() => { setModal({ open: false, editando: null }); carregar(); }}
        />
      )}

      {importOpen && (
        <ImportarClientesModal
          onClose={() => setImportOpen(false)}
          onComplete={() => { setImportOpen(false); carregar(); }}
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

// ─── Modal de Cliente ─────────────────────────────────────────────────

function ClienteModal({ editando, onClose, onSaved }) {
  const [form,    setForm]    = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro,    setErro]    = useState('');

  useEffect(() => {
    if (editando) {
      setForm({
        nome:               editando.nome               || '',
        tipoDocumento:      (editando.tipoDocumento || 'cnpj').toLowerCase(),
        documento:          editando.documento          || '',
        email:              editando.email              || '',
        telefone:           editando.telefone           || '',
        pessoaContato:      editando.pessoaContato      || '',
        emailsAdicionais:   Array.isArray(editando.emailsAdicionais) ? editando.emailsAdicionais.join('; ') : '',
        cep:                editando.cep                || '',
        logradouro:         editando.logradouro         || '',
        numero:             editando.numero             || '',
        complemento:        editando.complemento        || '',
        bairro:             editando.bairro             || '',
        cidade:             editando.cidade             || '',
        uf:                 editando.uf                 || '',
        inscricaoEstadual:  editando.inscricaoEstadual  || '',
        inscricaoMunicipal: editando.inscricaoMunicipal || '',
        endereco:           editando.endereco           || '',
        observacao:         editando.observacao         || '',
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
        await api.put(`/customers/${editando.id}`, form);
      } else {
        await api.post('/customers', form);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#152740]">
            {editando ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          <Section title="Identificação">
            <Field label="Nome / Razão Social" required>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                className={inputCls}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tipo">
                <select
                  value={form.tipoDocumento}
                  onChange={(e) => set('tipoDocumento', e.target.value)}
                  className={inputCls}
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
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Contato">
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail">
                <input type="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Telefone">
                <input type="text" value={form.telefone}
                  onChange={(e) => set('telefone', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Pessoa de contato">
                <input type="text" value={form.pessoaContato}
                  onChange={(e) => set('pessoaContato', e.target.value)} className={inputCls} />
              </Field>
              <Field label="E-mails adicionais" hint="Separe por ; ou ,">
                <input type="text" value={form.emailsAdicionais}
                  onChange={(e) => set('emailsAdicionais', e.target.value)}
                  placeholder="email1@x.com; email2@y.com" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Endereço">
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-2">
                <Field label="CEP">
                  <input type="text" value={form.cep}
                    onChange={(e) => set('cep', e.target.value)}
                    placeholder="00000-000" className={inputCls} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Logradouro">
                  <input type="text" value={form.logradouro}
                    onChange={(e) => set('logradouro', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Número">
                <input type="text" value={form.numero}
                  onChange={(e) => set('numero', e.target.value)} className={inputCls} />
              </Field>
              <div className="col-span-3">
                <Field label="Complemento">
                  <input type="text" value={form.complemento}
                    onChange={(e) => set('complemento', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Bairro">
                  <input type="text" value={form.bairro}
                    onChange={(e) => set('bairro', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="col-span-4">
                <Field label="Cidade">
                  <input type="text" value={form.cidade}
                    onChange={(e) => set('cidade', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="UF">
                  <input type="text" value={form.uf}
                    onChange={(e) => set('uf', e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2} className={inputCls + ' uppercase'} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Inscrições (Pessoa Jurídica)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inscrição Estadual">
                <input type="text" value={form.inscricaoEstadual}
                  onChange={(e) => set('inscricaoEstadual', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Inscrição Municipal">
                <input type="text" value={form.inscricaoMunicipal}
                  onChange={(e) => set('inscricaoMunicipal', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Observação">
            <Field label="Notas">
              <textarea rows={3} value={form.observacao}
                onChange={(e) => set('observacao', e.target.value)}
                className={inputCls + ' resize-none'} />
            </Field>
          </Section>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50">
            {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── Modal de Importação ──────────────────────────────────────────────

function ImportarClientesModal({ onClose, onComplete }) {
  const STEPS = { UPLOAD: 'upload', PREVIEW: 'preview', RUNNING: 'running', RESULT: 'result' };
  const [step,    setStep]    = useState(STEPS.UPLOAD);
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [erro,    setErro]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const fileInputRef = useRef(null);

  async function analisar() {
    if (!file) return;
    setBusy(true); setErro('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/customers/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = r.data?.data;
      if (!data || data.ok === false) {
        setErro(`Colunas obrigatórias ausentes: ${(data?.missing || []).join(', ')}`);
        setBusy(false);
        return;
      }
      setPreview(data);
      setStep(STEPS.PREVIEW);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao analisar planilha');
    } finally {
      setBusy(false);
    }
  }

  async function executar() {
    setStep(STEPS.RUNNING); setBusy(true); setErro('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/customers/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(r.data?.data);
      setStep(STEPS.RESULT);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao importar planilha');
      setStep(STEPS.PREVIEW);
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setErro(''); }
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setErro(''); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-[#152740]">Importar planilha de clientes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Compatível com o export de clientes do Domínio Contábil</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {erro && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          {step === STEPS.UPLOAD && (
            <>
              <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#152740] transition-colors cursor-pointer">
                {file ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      Arraste o arquivo aqui ou{' '}
                      <span className="text-[#152740] font-medium">clique para escolher</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">.xlsx, .xls ou .csv (até 10 MB)</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                  onChange={onFileChange} className="hidden" />
              </div>

              <div className="mt-5 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Colunas reconhecidas:</p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• <strong>Nome da Empresa</strong> (obrigatória)</li>
                  <li>• <strong>Business No</strong> — CPF ou CNPJ (obrigatória)</li>
                  <li>• E-mail · Contatos adicionais · Pessoa de Contato · Telefone · Notas</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Clientes já existentes (mesmo CPF/CNPJ) serão <strong>atualizados</strong>.
                </p>
              </div>
            </>
          )}

          {step === STEPS.PREVIEW && preview && (
            <div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <Stat label="Total" value={preview.totalRows} />
                <Stat label="Válidas" value={preview.summary.validCount} color="green" />
                <Stat label="A criar" value={preview.summary.willCreate} color="blue" />
                <Stat label="A atualizar" value={preview.summary.willUpdate} color="amber" />
              </div>

              {(preview.summary.invalidCount > 0 || preview.summary.duplicatesInFileCount > 0) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  {preview.summary.invalidCount} inválida(s) · {preview.summary.duplicatesInFileCount} duplicata(s) no arquivo (serão ignoradas)
                </div>
              )}

              {preview.sample.length > 0 && (
                <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500">Linha</th>
                        <th className="text-left px-3 py-2 text-gray-500">Ação</th>
                        <th className="text-left px-3 py-2 text-gray-500">Nome</th>
                        <th className="text-left px-3 py-2 text-gray-500">Documento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.sample.map((row) => (
                        <tr key={row._rowNumber}>
                          <td className="px-3 py-1.5 text-gray-500">{row._rowNumber}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              row.action === 'update' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {row.action === 'update' ? 'atualizar' : 'criar'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">{row.nome}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.documento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.errors && preview.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Erros e duplicatas ({preview.errors.length})</p>
                  <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto p-3 text-xs space-y-1">
                    {preview.errors.map((err, i) => (
                      <div key={i} className="text-red-700">
                        Linha {err.rowNumber}: {err.kind === 'invalid'
                          ? err.errors.map((e) => `${e.field} - ${e.message}`).join('; ')
                          : err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === STEPS.RUNNING && (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#152740] mb-4"></div>
              <p className="text-gray-700">Importando clientes...</p>
            </div>
          )}

          {step === STEPS.RESULT && result && (
            <div>
              <div className="text-center py-3 mb-4">
                <p className="text-lg font-semibold text-[#152740]">Importação concluída</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Total" value={result.totalRows} />
                <Stat label="Criados" value={result.createdCount} color="green" />
                <Stat label="Atualizados" value={result.updatedCount} color="amber" />
                <Stat label="Erros" value={result.errorCount} color="red" />
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Erros ({result.errors.length})</p>
                  <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto p-3 text-xs space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-red-700">
                        Linha {err.row}: {err.errors
                          ? err.errors.map((e) => `${e.field} - ${e.message}`).join('; ')
                          : err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === STEPS.UPLOAD && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={analisar} disabled={!file || busy}
                className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50">
                {busy ? 'Analisando...' : 'Analisar planilha'}
              </button>
            </>
          )}
          {step === STEPS.PREVIEW && (
            <>
              <button onClick={() => setStep(STEPS.UPLOAD)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Voltar</button>
              <button onClick={executar} disabled={preview?.summary?.validCount === 0}
                className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50">
                Confirmar ({preview?.summary?.validCount || 0})
              </button>
            </>
          )}
          {step === STEPS.RESULT && (
            <button onClick={onComplete}
              className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f]">
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'gray' }) {
  const colors = {
    gray:  'bg-gray-50 text-gray-700',
    green: 'bg-green-50 text-green-700',
    blue:  'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
