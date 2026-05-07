// frontend/src/components/ui/SelectComCadastro.jsx
// Etapa 4.2 - Dropdown searchable com cadastro rápido inline.
//
// Uso típico (dentro do modal de Título):
//
//   <SelectComCadastro
//     label="Fornecedor"
//     endpoint="/suppliers"
//     value={form.supplierId}
//     onChange={(id, item) => set('supplierId', id)}
//     getLabel={(s) => s.nome}
//     getSubLabel={(s) => s.documento}
//     placeholder="Selecione um fornecedor..."
//     cadastroFields={[
//       { name: 'nome',          label: 'Nome',     required: true },
//       { name: 'tipoDocumento', label: 'Tipo',     type: 'select',
//         options: [{ value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }] },
//       { name: 'documento',     label: 'CPF/CNPJ' },
//     ]}
//   />
//
// Props:
//   label            -- string (rótulo acima do select)
//   endpoint         -- string (ex.: '/suppliers' ou '/customers')
//   value            -- string|null (id selecionado)
//   onChange         -- (id, item) => void
//   getLabel         -- (item) => string  (default: item.nome || item.descricao)
//   getSubLabel      -- (item) => string  (opcional, mostra abaixo do label em cinza)
//   placeholder      -- string
//   cadastroFields   -- Array<{ name, label, type?, required?, options? }>
//                       type: 'text' (default) | 'select'
//   disabled         -- boolean
//   required         -- boolean

import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const labelDefault    = (it) => it?.nome || it?.descricao || '';
const subLabelDefault = (it) => it?.documento || '';

export default function SelectComCadastro({
  label,
  endpoint,
  value,
  onChange,
  getLabel    = labelDefault,
  getSubLabel = subLabelDefault,
  placeholder = 'Selecione...',
  cadastroFields = [],
  disabled = false,
  required = false,
}) {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [busca,    setBusca]    = useState('');
  const [modoCad,  setModoCad]  = useState(false);
  const [novoForm, setNovoForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState('');

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // Carrega itens ao montar
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setLoading(true);
      try {
        const r = await api.get(endpoint);
        if (cancelado) return;
        const lista = Array.isArray(r.data?.data) ? r.data.data
                    : Array.isArray(r.data?.data?.data) ? r.data.data.data
                    : Array.isArray(r.data) ? r.data : [];
        setItems(lista);
      } catch (e) {
        console.error('[SelectComCadastro] erro ao carregar:', e);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [endpoint]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setModoCad(false);
        setBusca('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Inicializa form de cadastro com defaults dos campos
  useEffect(() => {
    if (modoCad) {
      const init = {};
      cadastroFields.forEach((f) => {
        if (f.type === 'select' && f.options?.length) init[f.name] = f.options[0].value;
        else init[f.name] = '';
      });
      setNovoForm(init);
      setErro('');
    }
  }, [modoCad]);

  const selecionado = useMemo(
    () => items.find((it) => it.id === value) || null,
    [items, value]
  );

  const filtrados = useMemo(() => {
    if (!busca.trim()) return items;
    const q = busca.toLowerCase();
    return items.filter((it) => {
      const l = String(getLabel(it) || '').toLowerCase();
      const s = String(getSubLabel(it) || '').toLowerCase();
      return l.includes(q) || s.includes(q);
    });
  }, [items, busca, getLabel, getSubLabel]);

  function selecionar(item) {
    onChange(item.id, item);
    setOpen(false);
    setBusca('');
  }

  function limpar(e) {
    e.stopPropagation();
    onChange(null, null);
  }

  async function salvarNovo() {
    setSalvando(true);
    setErro('');
    try {
      const obrigatorios = cadastroFields.filter((f) => f.required);
      for (const f of obrigatorios) {
        if (!novoForm[f.name] || !String(novoForm[f.name]).trim()) {
          throw new Error(`Campo "${f.label}" é obrigatório`);
        }
      }
      const r = await api.post(endpoint, novoForm);
      const criado = r.data?.data || r.data;
      setItems((prev) => [criado, ...prev]);
      onChange(criado.id, criado);
      setModoCad(false);
      setOpen(false);
      setBusca('');
    } catch (e) {
      setErro(e.response?.data?.error || e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full text-left px-3 py-2 border rounded-lg text-sm flex items-center justify-between gap-2
          ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-white hover:border-[#152740] focus:outline-none focus:ring-2 focus:ring-[#152740]/20'}
          ${selecionado ? 'border-gray-300 text-gray-900' : 'border-gray-300 text-gray-400'}`}
      >
        <span className="truncate">
          {selecionado ? (
            <>
              <span className="text-gray-900">{getLabel(selecionado)}</span>
              {getSubLabel(selecionado) && (
                <span className="text-gray-400 ml-2">· {getSubLabel(selecionado)}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex items-center gap-1">
          {selecionado && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={limpar}
              className="text-gray-400 hover:text-gray-600 px-1"
              title="Limpar"
            >
              ×
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          {!modoCad ? (
            <>
              <div className="p-2 border-b border-gray-100">
                <input
                  ref={inputRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#152740]"
                />
              </div>

              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-400">Carregando...</div>
                ) : filtrados.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-400">Nenhum resultado</div>
                ) : (
                  filtrados.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => selecionar(it)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col
                        ${it.id === value ? 'bg-[#152740]/5' : ''}`}
                    >
                      <span className="text-gray-900">{getLabel(it)}</span>
                      {getSubLabel(it) && (
                        <span className="text-xs text-gray-500">{getSubLabel(it)}</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {cadastroFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModoCad(true)}
                  className="px-3 py-2 text-sm text-[#152740] font-medium border-t border-gray-100 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-base leading-none">+</span> Cadastrar novo
                </button>
              )}
            </>
          ) : (
            // ── Form de cadastro rápido ───────────────────────
            <div className="p-3 space-y-2">
              <div className="text-sm font-semibold text-[#152740] mb-1">Cadastro rápido</div>
              {cadastroFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs text-gray-600 mb-0.5">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={novoForm[f.name] || ''}
                      onChange={(e) => setNovoForm({ ...novoForm, [f.name]: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#152740]"
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'email' ? 'email' : 'text'}
                      value={novoForm[f.name] || ''}
                      onChange={(e) => setNovoForm({ ...novoForm, [f.name]: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#152740]"
                    />
                  )}
                </div>
              ))}

              {erro && <div className="text-xs text-red-600">{erro}</div>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModoCad(false)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={salvarNovo}
                  disabled={salvando}
                  className="flex-1 px-3 py-1.5 text-sm text-white bg-[#152740] rounded-md hover:bg-[#1e3a5f] disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
