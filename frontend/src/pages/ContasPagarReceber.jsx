// frontend/src/pages/ContasPagarReceber.jsx
// Etapa 4.1 (parcelamento) + Etapa 4.2 (supplier/customer)
//
// Mudanças vs. versão anterior:
//   - Tabela mostra badge "N/T" quando o título é parcela de um grupo
//   - Modal de Título usa <SelectComCadastro> para fornecedor / cliente / categoria
//   - Modal de Título tem bloco de parcelamento (apenas no CREATE; não no edit)
//   - Ação "Excluir grupo" disponível em parcelas em aberto
//
// Endpoint de listagem é o mesmo (`/titles`); body de criação ganha
// `supplierId`, `customerId`, `parcelamento`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import SelectComCadastro from '../components/ui/SelectComCadastro';

// ─── Constantes ─────────────────────────────────────────────────────────

const STATUS_STYLE = {
  aberto:    { label: 'Em Aberto', cls: 'bg-blue-100 text-blue-700' },
  parcial:   { label: 'Parcial',   cls: 'bg-amber-100 text-amber-700' },
  pago:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
};

const fmtMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData  = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

function isVencido(t) {
  if (t.status !== 'aberto' && t.status !== 'parcial') return false;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return new Date(t.dataVencimento) < hoje;
}

// ─── Página ─────────────────────────────────────────────────────────────

export default function ContasPagarReceber() {
  const location = useLocation();
  const tabPadrao = location.pathname.includes('contas-receber') ? 'receber' : 'pagar';

  const [tab,        setTab]        = useState(tabPadrao);
  const [titulos,    setTitulos]    = useState([]);
  const [resumo,     setResumo]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [filtros,    setFiltros]    = useState({ status: 'aberto', search: '', dateFrom: '', dateTo: '' });
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalTitulo, setModalTitulo] = useState({ open: false, editando: null });
  const [modalBaixa,  setModalBaixa]  = useState({ open: false, titulo: null });

  // Reagir a mudança de URL (navegar entre /contas-pagar e /contas-receber)
  useEffect(() => {
    setTab(location.pathname.includes('contas-receber') ? 'receber' : 'pagar');
    setPage(1);
  }, [location.pathname]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tipo: tab, page, limit: 50, ...filtros };
      const [listRes, sumRes] = await Promise.all([
        api.get('/titles', { params }),
        api.get('/titles/summary'),
      ]);
      setTitulos(listRes.data.data?.data || []);
      setTotalPages(listRes.data.data?.totalPages || 1);
      setResumo(sumRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab, filtros, page]);

  useEffect(() => { carregar(); }, [carregar]);

  function setFiltro(k, v) {
    setFiltros((f) => ({ ...f, [k]: v }));
    setPage(1);
  }

  async function excluir(t) {
    const isParcela = !!t.grupoParcelamentoId;
    const msg = isParcela
      ? `Este título é a parcela ${t.parcelaNumero}/${t.parcelaTotal} de um grupo. Excluir apenas esta parcela?`
      : 'Excluir este título?';
    if (!confirm(msg)) return;
    try {
      await api.delete(`/titles/${t.id}`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  async function excluirGrupo(grupoId) {
    if (!confirm('Excluir TODAS as parcelas em aberto deste grupo?\nParcelas pagas/canceladas serão preservadas.')) return;
    try {
      const r = await api.delete(`/titles/grupo/${grupoId}`);
      const { excluidas, preservadas } = r.data.data || {};
      alert(`${excluidas} parcela(s) excluída(s).${preservadas ? ` ${preservadas} preservada(s).` : ''}`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir grupo');
    }
  }

  async function cancelar(id) {
    if (!confirm('Cancelar este título?')) return;
    try {
      await api.post(`/titles/${id}/cancelar`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao cancelar');
    }
  }

  const isPagar = tab === 'pagar';
  const cores = isPagar
    ? { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   btn: 'bg-red-600 hover:bg-red-700' }
    : { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' };

  const blocoResumo = resumo ? (isPagar ? resumo.pagar : resumo.receber) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">Contas a Pagar e Receber</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gerenciamento de títulos com baixa por conta bancária
          </p>
        </div>
        <button
          onClick={() => setModalTitulo({ open: true, editando: null })}
          className="px-4 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors"
        >
          + Novo Título
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <TabBtn ativo={tab === 'pagar'}   onClick={() => { setTab('pagar'); setPage(1); }}>
          Contas a Pagar
        </TabBtn>
        <TabBtn ativo={tab === 'receber'} onClick={() => { setTab('receber'); setPage(1); }}>
          Contas a Receber
        </TabBtn>
      </div>

      {/* Resumo */}
      {blocoResumo && (
        <div className={`grid grid-cols-2 gap-4 mb-6`}>
          <div className={`${cores.bg} ${cores.border} border rounded-xl p-4`}>
            <div className="text-xs uppercase tracking-wide text-gray-600">Total em aberto</div>
            <div className={`text-2xl font-bold ${cores.text} mt-1`}>{fmtMoeda(blocoResumo.total)}</div>
            <div className="text-xs text-gray-500 mt-1">{blocoResumo.count} título(s)</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-600">Vencidos</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{fmtMoeda(blocoResumo.vencido)}</div>
            <div className="text-xs text-gray-500 mt-1">{blocoResumo.vencidoCount} título(s)</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filtros.status}
          onChange={(e) => setFiltro('status', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        >
          <option value="">Todos</option>
          <option value="aberto">Em aberto</option>
          <option value="parcial">Parcial</option>
          <option value="pago">Pagos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <input
          type="date"
          value={filtros.dateFrom}
          onChange={(e) => setFiltro('dateFrom', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        />
        <input
          type="date"
          value={filtros.dateTo}
          onChange={(e) => setFiltro('dateTo', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        />
        <input
          type="text"
          placeholder="Buscar..."
          value={filtros.search}
          onChange={(e) => setFiltro('search', e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th>Vencimento</Th>
              <Th>Descrição</Th>
              <Th>{isPagar ? 'Fornecedor' : 'Cliente'}</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Valor</Th>
              <Th>Status</Th>
              <Th className="text-right pr-4">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Carregando...</td></tr>
            ) : titulos.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Nenhum título encontrado</td></tr>
            ) : (
              titulos.map((t) => {
                const vencido = isVencido(t);
                const contato = isPagar
                  ? (t.supplier?.nome || t.nomeContato)
                  : (t.customer?.nome || t.nomeContato);
                return (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <Td>
                      <span className={vencido ? 'text-red-600 font-medium' : 'text-gray-700'}>
                        {fmtData(t.dataVencimento)}
                      </span>
                      {vencido && <div className="text-xs text-red-500">vencido</div>}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{t.descricao}</span>
                        {t.parcelaNumero && t.parcelaTotal && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 rounded"
                            title={`Parcela ${t.parcelaNumero} de ${t.parcelaTotal} · Total: ${fmtMoeda(t.valorTotalGrupo)}`}
                          >
                            {t.parcelaNumero}/{t.parcelaTotal}
                          </span>
                        )}
                      </div>
                      {t.numeroDocumento && (
                        <div className="text-xs text-gray-400">Doc: {t.numeroDocumento}</div>
                      )}
                    </Td>
                    <Td>{contato || <span className="text-gray-300">—</span>}</Td>
                    <Td>{t.category?.nome || <span className="text-gray-300">—</span>}</Td>
                    <Td className="text-right font-medium">{fmtMoeda(t.valor)}</Td>
                    <Td>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_STYLE[t.status]?.cls}`}>
                        {STATUS_STYLE[t.status]?.label || t.status}
                      </span>
                    </Td>
                    <Td className="text-right pr-4">
                      {(t.status === 'aberto' || t.status === 'parcial') && (
                        <>
                          <button
                            onClick={() => setModalBaixa({ open: true, titulo: t })}
                            className={`text-xs px-2 py-1 mr-1 text-white rounded ${cores.btn}`}
                          >
                            {isPagar ? 'Pagar' : 'Receber'}
                          </button>
                          <button
                            onClick={() => setModalTitulo({ open: true, editando: t })}
                            className="text-xs text-[#152740] hover:underline mr-2"
                          >Editar</button>
                          <button
                            onClick={() => cancelar(t.id)}
                            className="text-xs text-amber-600 hover:underline mr-2"
                          >Cancelar</button>
                          <button
                            onClick={() => excluir(t)}
                            className="text-xs text-red-600 hover:underline"
                          >Excluir</button>
                          {t.grupoParcelamentoId && (
                            <button
                              onClick={() => excluirGrupo(t.grupoParcelamentoId)}
                              className="block ml-auto mt-1 text-xs text-red-700 hover:underline"
                              title="Exclui todas as parcelas em aberto do grupo"
                            >Excluir grupo</button>
                          )}
                        </>
                      )}
                      {t.status === 'pago' && (
                        <span className="text-xs text-gray-400">Baixado em {fmtData(t.dataPagamento)}</span>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >Anterior</button>
            <span className="text-gray-500">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >Próxima</button>
          </div>
        )}
      </div>

      {/* Modais */}
      {modalTitulo.open && (
        <TituloModal
          tipoPadrao={tab}
          editando={modalTitulo.editando}
          onClose={() => setModalTitulo({ open: false, editando: null })}
          onSaved={() => { setModalTitulo({ open: false, editando: null }); carregar(); }}
        />
      )}
      {modalBaixa.open && (
        <BaixaModal
          titulo={modalBaixa.titulo}
          onClose={() => setModalBaixa({ open: false, titulo: null })}
          onSaved={() => { setModalBaixa({ open: false, titulo: null }); carregar(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────

function TabBtn({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
        ${ativo ? 'border-[#152740] text-[#152740]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>;
}

// ─── Modal de criação/edição de Título ─────────────────────────────────

const formVazio = {
  tipo:            'pagar',
  descricao:       '',
  valor:           '',
  dataEmissao:     new Date().toISOString().slice(0, 10),
  dataVencimento:  '',
  categoryId:      null,
  bankAccountId:   '',
  numeroDocumento: '',
  nomeContato:     '',
  observacao:      '',
  supplierId:      null,
  customerId:      null,
};

const parcelamentoVazio = { ativo: false, numeroParcelas: 2, intervaloDias: 30 };

function TituloModal({ tipoPadrao, editando, onClose, onSaved }) {
  const [form,         setForm]         = useState({ ...formVazio, tipo: tipoPadrao });
  const [parcelamento, setParcelamento] = useState(parcelamentoVazio);
  const [contas,       setContas]       = useState([]);
  const [salvando,     setSalvando]     = useState(false);
  const [erro,         setErro]         = useState('');

  const isEdit = !!editando;
  const isPagar = form.tipo === 'pagar';

  // Carrega contas bancárias (necessário para dropdown)
  useEffect(() => {
    api.get('/bank-accounts').then((r) => {
      const lista = Array.isArray(r.data?.data) ? r.data.data : [];
      setContas(lista);
    });
  }, []);

  // Inicializa form com dados de edição (ou tipo padrão)
  useEffect(() => {
    if (editando) {
      setForm({
        tipo:            editando.tipo,
        descricao:       editando.descricao        || '',
        valor:           String(editando.valor)    || '',
        dataEmissao:     editando.dataEmissao?.slice(0, 10)    || '',
        dataVencimento:  editando.dataVencimento?.slice(0, 10) || '',
        categoryId:      editando.categoryId       || null,
        bankAccountId:   editando.bankAccountId    || '',
        numeroDocumento: editando.numeroDocumento  || '',
        nomeContato:     editando.nomeContato      || '',
        observacao:      editando.observacao       || '',
        supplierId:      editando.supplierId       || null,
        customerId:      editando.customerId       || null,
      });
    } else {
      setForm({ ...formVazio, tipo: tipoPadrao });
    }
    setParcelamento(parcelamentoVazio);
    setErro('');
  }, [editando, tipoPadrao]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Quando troca o tipo, limpa o "outro" cadastro
  function trocarTipo(novo) {
    setForm((f) => ({
      ...f,
      tipo: novo,
      categoryId: null,
      supplierId: novo === 'pagar'   ? f.supplierId : null,
      customerId: novo === 'receber' ? f.customerId : null,
    }));
  }

  // Preview de parcelas (cálculo no front, espelhando o backend)
  const previewParcelas = useMemo(() => {
    if (!parcelamento.ativo) return [];
    const valor = Number(form.valor);
    const n     = parseInt(parcelamento.numeroParcelas, 10);
    const intervalo = parseInt(parcelamento.intervaloDias, 10);
    if (!Number.isFinite(valor) || valor <= 0 || !Number.isFinite(n) || n < 2 || !form.dataVencimento) return [];
    const totalCent = Math.round(valor * 100);
    const base = Math.floor(totalCent / n);
    const resto = totalCent - base * n;
    const dt = new Date(form.dataVencimento);
    const out = [];
    for (let i = 0; i < n; i++) {
      const cents = i === n - 1 ? base + resto : base;
      const v = new Date(dt);
      v.setDate(v.getDate() + intervalo * i);
      out.push({ numero: i + 1, valor: cents / 100, vencimento: v });
    }
    return out;
  }, [parcelamento, form.valor, form.dataVencimento]);

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      if (!form.descricao.trim())        throw new Error('Descrição obrigatória');
      if (!form.valor || Number(form.valor) <= 0) throw new Error('Valor deve ser maior que zero');
      if (!form.dataVencimento)          throw new Error('Vencimento obrigatório');

      const payload = {
        ...form,
        valor: Number(form.valor),
      };
      if (!isEdit && parcelamento.ativo && Number(parcelamento.numeroParcelas) > 1) {
        payload.parcelamento = parcelamento;
      }

      if (isEdit) {
        await api.put(`/titles/${editando.id}`, payload);
      } else {
        await api.post('/titles', payload);
      }
      onSaved();
    } catch (e) {
      setErro(e.response?.data?.error || e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#152740]">
            {isEdit ? 'Editar Título' : 'Novo Título'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Tipo */}
          {!isEdit && (
            <div className="flex gap-2">
              {[
                { v: 'pagar',   l: 'A Pagar',   c: 'red' },
                { v: 'receber', l: 'A Receber', c: 'green' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => trocarTipo(opt.v)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors
                    ${form.tipo === opt.v
                      ? opt.c === 'red'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          )}

          {/* Descrição */}
          <Field label="Descrição" required>
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
            />
          </Field>

          {/* Valor + Vencimento + Emissão */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor" required>
              <input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
            <Field label="Vencimento" required>
              <input
                type="date"
                value={form.dataVencimento}
                onChange={(e) => set('dataVencimento', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
            <Field label="Emissão">
              <input
                type="date"
                value={form.dataEmissao}
                onChange={(e) => set('dataEmissao', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
          </div>

          {/* Fornecedor OU Cliente */}
          {isPagar ? (
            <SelectComCadastro
              label="Fornecedor"
              endpoint="/suppliers"
              value={form.supplierId}
              onChange={(id) => set('supplierId', id)}
              placeholder="Selecione um fornecedor (opcional)..."
              cadastroFields={[
                { name: 'nome',          label: 'Nome',     required: true },
                { name: 'tipoDocumento', label: 'Tipo',     type: 'select',
                  options: [{ value: 'cnpj', label: 'CNPJ' }, { value: 'cpf', label: 'CPF' }] },
                { name: 'documento',     label: 'CNPJ / CPF' },
              ]}
            />
          ) : (
            <SelectComCadastro
              label="Cliente"
              endpoint="/customers"
              value={form.customerId}
              onChange={(id) => set('customerId', id)}
              placeholder="Selecione um cliente (opcional)..."
              cadastroFields={[
                { name: 'nome',          label: 'Nome',     required: true },
                { name: 'tipoDocumento', label: 'Tipo',     type: 'select',
                  options: [{ value: 'cnpj', label: 'CNPJ' }, { value: 'cpf', label: 'CPF' }] },
                { name: 'documento',     label: 'CNPJ / CPF' },
              ]}
            />
          )}

          {/* Categoria */}
          <SelectComCadastro
            label="Categoria"
            endpoint={`/categories?tipo=${isPagar ? 'despesa' : 'receita'}`}
            value={form.categoryId}
            onChange={(id) => set('categoryId', id)}
            placeholder="Selecione uma categoria (opcional)..."
            getLabel={(c) => c.nome}
            getSubLabel={(c) => c.dominioContaCredito || ''}
          />

          {/* Documento + Conta bancária */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº Documento">
              <input
                type="text"
                value={form.numeroDocumento}
                onChange={(e) => set('numeroDocumento', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
            <Field label="Conta bancária prevista">
              <select
                value={form.bankAccountId}
                onChange={(e) => set('bankAccountId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              >
                <option value="">— Não informada —</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome || c.descricao}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Observação */}
          <Field label="Observação">
            <textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740] resize-none"
            />
          </Field>

          {/* ─── Bloco de Parcelamento (apenas no CREATE) ─── */}
          {!isEdit && (
            <div className="border border-purple-200 bg-purple-50 rounded-xl p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-purple-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parcelamento.ativo}
                  onChange={(e) => setParcelamento((p) => ({ ...p, ativo: e.target.checked }))}
                  className="accent-purple-600"
                />
                Parcelar este lançamento
              </label>

              {parcelamento.ativo && (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field label="Número de parcelas">
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={parcelamento.numeroParcelas}
                        onChange={(e) => setParcelamento((p) => ({ ...p, numeroParcelas: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      />
                    </Field>
                    <Field label="Intervalo (dias)">
                      <input
                        type="number"
                        min={1}
                        value={parcelamento.intervaloDias}
                        onChange={(e) => setParcelamento((p) => ({ ...p, intervaloDias: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      />
                    </Field>
                  </div>

                  {previewParcelas.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto bg-white rounded-lg border border-purple-100 text-xs">
                      <table className="w-full">
                        <thead className="bg-purple-50 text-purple-700 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left">#</th>
                            <th className="px-2 py-1.5 text-left">Vencimento</th>
                            <th className="px-2 py-1.5 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewParcelas.map((p) => (
                            <tr key={p.numero} className="border-t border-purple-100">
                              <td className="px-2 py-1 text-gray-500">{p.numero}/{previewParcelas.length}</td>
                              <td className="px-2 py-1">{fmtData(p.vencimento)}</td>
                              <td className="px-2 py-1 text-right font-medium">{fmtMoeda(p.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-purple-50 sticky bottom-0">
                          <tr>
                            <td colSpan={2} className="px-2 py-1 text-right text-purple-700 font-medium">Total</td>
                            <td className="px-2 py-1 text-right text-purple-900 font-bold">
                              {fmtMoeda(previewParcelas.reduce((s, p) => s + p.valor, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : isEdit ? 'Salvar Alterações' : (parcelamento.ativo ? 'Lançar Parcelas' : 'Criar Título')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Baixa (preservado da versão anterior) ─────────────────────

function BaixaModal({ titulo, onClose, onSaved }) {
  const [form,    setForm]    = useState({ dataPagamento: '', valorPago: '', bankAccountId: '', observacao: '' });
  const [contas,  setContas]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  useEffect(() => {
    if (!titulo) return;
    setForm({
      dataPagamento: new Date().toISOString().slice(0, 10),
      valorPago:     String(titulo.valor),
      bankAccountId: titulo.bankAccountId || '',
      observacao:    '',
    });
    api.get('/bank-accounts').then((r) => {
      setContas(Array.isArray(r.data?.data) ? r.data.data : []);
    });
  }, [titulo]);

  if (!titulo) return null;
  const isPagar = titulo.tipo === 'pagar';

  async function salvar() {
    setLoading(true);
    setErro('');
    try {
      await api.post(`/titles/${titulo.id}/baixa`, {
        ...form,
        valorPago: Number(form.valorPago),
      });
      onSaved();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao baixar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`px-6 py-4 border-b rounded-t-2xl ${isPagar ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <h2 className="text-lg font-semibold text-[#152740]">
            {isPagar ? 'Pagar Título' : 'Receber Título'}
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">{titulo.descricao}</p>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <input
                type="date"
                value={form.dataPagamento}
                onChange={(e) => setForm((f) => ({ ...f, dataPagamento: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
            <Field label="Valor" required>
              <input
                type="number"
                step="0.01"
                value={form.valorPago}
                onChange={(e) => setForm((f) => ({ ...f, valorPago: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
              />
            </Field>
          </div>
          <Field label="Conta bancária" required>
            <select
              value={form.bankAccountId}
              onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740]"
            >
              <option value="">— Selecione —</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome || c.descricao}</option>
              ))}
            </select>
          </Field>
          <Field label="Observação">
            <textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#152740] resize-none"
            />
          </Field>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading}
            className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${isPagar ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {loading ? 'Processando...' : isPagar ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
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
