import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import recurringTitlesService from '../services/recurringTitlesService';
import api from '../services/api';
import SelectComCadastro from '../components/ui/SelectComCadastro';

// ─────────────────────────────────────────────────────────────────────────
// Constantes de UI
// ─────────────────────────────────────────────────────────────────────────

const FREQUENCIAS = [
  { value: 'mensal',    label: 'Mensal' },
  { value: 'semanal',   label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'anual',     label: 'Anual' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const TIPO_LABEL = { pagar: 'Pagar', receber: 'Receber' };
const FREQ_LABEL = Object.fromEntries(FREQUENCIAS.map(f => [f.value, f.label]));

const fmt     = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

// ─────────────────────────────────────────────────────────────────────────
// Labels por tipo travado pela URL (?tipo=pagar | ?tipo=receber | nenhum)
//
// Centraliza os textos da página em UM lugar pra evitar inconsistências.
// Quando não há tipoLocked, a página continua se comportando como a
// "Recorrências Fixas" original — mostra ambos os tipos.
// ─────────────────────────────────────────────────────────────────────────

function getLabels(tipoLocked) {
  if (tipoLocked === 'pagar') {
    return {
      pageTitle:    'Despesas Fixas',
      pageDesc:     'Despesas que se repetem automaticamente (aluguel, energia, sistemas, salários…).',
      newButton:    '+ Nova Despesa Fixa',
      modalNew:     'Nova Despesa Fixa',
      modalEdit:    'Editar Despesa Fixa',
      emptyTitle:   'Nenhuma despesa fixa encontrada',
      emptyAction:  'Cadastrar primeira despesa fixa',
      descricaoPh:  'Ex: Aluguel da loja, Energia, Salários…',
      contatoLabel: 'Fornecedor',
      confirmCancel: 'Cancelar esta despesa fixa?\n\nIsso para a geração de novos títulos. Os títulos já gerados continuam existindo.',
      confirmDelete: 'Excluir esta despesa fixa?\n\nO template será apagado. Títulos já gerados não serão apagados.',
    };
  }
  if (tipoLocked === 'receber') {
    return {
      pageTitle:    'Contratos Recorrentes',
      pageDesc:     'Receitas que se repetem automaticamente (mensalidades, contratos de prestação de serviço, assinaturas…).',
      newButton:    '+ Novo Contrato',
      modalNew:     'Novo Contrato',
      modalEdit:    'Editar Contrato',
      emptyTitle:   'Nenhum contrato encontrado',
      emptyAction:  'Cadastrar primeiro contrato',
      descricaoPh:  'Ex: Mensalidade contrato XYZ, Aluguel recebido…',
      contatoLabel: 'Cliente',
      confirmCancel: 'Cancelar este contrato?\n\nIsso para a geração de novos títulos. Os títulos já gerados continuam existindo.',
      confirmDelete: 'Excluir este contrato?\n\nO template será apagado. Títulos já gerados não serão apagados.',
    };
  }
  return {
    pageTitle:    'Recorrências Fixas',
    pageDesc:     'Cobranças/despesas que se repetem automaticamente (aluguel, energia, salários, etc).',
    newButton:    '+ Nova Recorrência',
    modalNew:     'Nova Recorrência',
    modalEdit:    'Editar Recorrência',
    emptyTitle:   'Nenhuma recorrência encontrada',
    emptyAction:  'Criar primeira recorrência',
    descricaoPh:  'Ex: Aluguel da loja, Energia, Salários…',
    contatoLabel: null, // dinâmico no form (Fornecedor/Cliente)
    confirmCancel: 'Cancelar esta recorrência?\n\nIsso para a geração de novos títulos. Os títulos já gerados continuam existindo.',
    confirmDelete: 'Excluir esta recorrência?\n\nO template será apagado. Títulos já gerados não serão apagados.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Cálculo de "próximo vencimento" no frontend (cosmético)
// Mesma lógica do backend (recurring-titles.service.js), simplificada.
// ─────────────────────────────────────────────────────────────────────────

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function calcularProximoVencimento(template) {
  if (!template.ativo) return null;
  const hoje = startOfDay(new Date());
  const inicio = startOfDay(template.dataInicio);
  const dia = template.diaVencimento;

  switch (template.frequencia) {
    case 'mensal': {
      // Próximo mês onde o dia X cai >= max(hoje, inicio)
      const cursor = new Date(Math.max(hoje.getTime(), inicio.getTime()));
      for (let i = 0; i < 13; i++) {
        const ano = cursor.getFullYear();
        const mes = cursor.getMonth() + i;
        const ultimoDia = new Date(ano, mes + 1, 0).getDate();
        const venc = startOfDay(new Date(ano, mes, Math.min(dia, ultimoDia)));
        if (venc >= hoje && venc >= inicio) return venc;
      }
      return null;
    }
    case 'anual': {
      const mesBase = inicio.getMonth();
      let ano = Math.max(hoje.getFullYear(), inicio.getFullYear());
      for (let i = 0; i < 5; i++) {
        const ultimoDia = new Date(ano + i, mesBase + 1, 0).getDate();
        const venc = startOfDay(new Date(ano + i, mesBase, Math.min(dia, ultimoDia)));
        if (venc >= hoje && venc >= inicio) return venc;
      }
      return null;
    }
    case 'semanal':
    case 'quinzenal': {
      const base = hoje > inicio ? hoje : inicio;
      const diff = (dia - base.getDay() + 7) % 7;
      return startOfDay(new Date(base.getTime() + diff * 86400000));
    }
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export default function RecorrenciasFixas() {
  // tipoLocked vem da URL (?tipo=pagar|receber). Quando presente, a página
  // se apresenta como "Despesas Fixas" ou "Contratos Recorrentes" e trava
  // o filtro de tipo. Quando ausente, mantém comportamento legado (todos).
  const [searchParams] = useSearchParams();
  const tipoLocked = searchParams.get('tipo'); // 'pagar' | 'receber' | null
  const labels = getLabels(tipoLocked);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ tipo: tipoLocked || '', ativo: 'true' });
  const [modal, setModal]         = useState({ open: false, template: null });

  // Sincroniza o filtro de tipo quando o usuário navega entre os links
  // do sidebar (Despesas Fixas ↔ Contratos Recorrentes) sem desmontar.
  useEffect(() => {
    setFilters(f => ({ ...f, tipo: tipoLocked || '' }));
  }, [tipoLocked]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.tipo)  params.tipo  = filters.tipo;
      if (filters.ativo !== '') params.ativo = filters.ativo;
      const res = await recurringTitlesService.list(params);
      setTemplates(res.data.data?.data || []);
    } catch (e) {
      console.error('[RecorrenciasFixas] erro ao carregar:', e);
      setTemplates([]);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleCancelar = async (id) => {
    if (!confirm(labels.confirmCancel)) return;
    try {
      await recurringTitlesService.cancelar(id);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao cancelar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(labels.confirmDelete)) return;
    try {
      await recurringTitlesService.remove(id);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#152740]">{labels.pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{labels.pageDesc}</p>
        </div>
        <button
          onClick={() => setModal({ open: true, template: null })}
          className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors">
          {labels.newButton}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-3">
          {/* Filtro de tipo: só aparece quando NÃO veio travado pela URL */}
          {!tipoLocked && (
            <select
              value={filters.tipo}
              onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
              <option value="">Todos os tipos</option>
              <option value="pagar">A Pagar</option>
              <option value="receber">A Receber</option>
            </select>
          )}
          <select
            value={filters.ativo}
            onChange={e => setFilters(f => ({ ...f, ativo: e.target.value }))}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
            <option value="">Todos os status</option>
            <option value="true">Ativas</option>
            <option value="false">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Carregando...</div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <div className="text-4xl mb-2">↻</div>
            <p>{labels.emptyTitle}</p>
            <button
              onClick={() => setModal({ open: true, template: null })}
              className="mt-3 text-sm text-[#152740] underline">
              {labels.emptyAction}
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Descrição</th>
                {/* Coluna Tipo: só aparece quando NÃO há tipoLocked */}
                {!tipoLocked && (
                  <th className="text-left px-3 py-3 text-gray-500 font-medium">Tipo</th>
                )}
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Frequência</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Próximo Venc.</th>
                <th className="text-right px-3 py-3 text-gray-500 font-medium">Valor</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => {
                const proximo = calcularProximoVencimento(t);
                return (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#152740]">{t.descricao}</div>
                      {t.nomeContato && <div className="text-xs text-gray-400">{t.nomeContato}</div>}
                      {t.category?.nome && <div className="text-xs text-gray-400">{t.category.nome}</div>}
                    </td>
                    {!tipoLocked && (
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.tipo === 'pagar' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {TIPO_LABEL[t.tipo]}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3 text-gray-600">{FREQ_LABEL[t.frequencia] || t.frequencia}</td>
                    <td className="px-3 py-3 text-gray-600">{fmtDate(proximo)}</td>
                    <td className="px-3 py-3 text-right font-medium text-[#152740]">{fmt(t.valor)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.ativo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {t.ativo ? 'Ativa' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {t.ativo && (
                          <>
                            <button onClick={() => setModal({ open: true, template: t })}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-[#152740] border border-gray-200 rounded-lg">
                              Editar
                            </button>
                            <button onClick={() => handleCancelar(t.id)}
                              className="px-3 py-1 text-xs text-amber-600 hover:text-amber-700 border border-amber-200 rounded-lg">
                              Cancelar
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(t.id)}
                          className="px-3 py-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de criar/editar */}
      <RecorrenciaFormModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, template: null })}
        onSaved={load}
        template={modal.template}
        tipoLocked={tipoLocked}
        labels={labels}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal de criar/editar recorrência
// ─────────────────────────────────────────────────────────────────────────

function RecorrenciaFormModal({ isOpen, onClose, onSaved, template, tipoLocked, labels }) {
  const isEdit = !!template;
  const [form, setForm] = useState(emptyForm(tipoLocked));
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  function emptyForm(tipoDefault) {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      tipo: tipoDefault || 'pagar',
      descricao: '',
      valor: '',
      frequencia: 'mensal',
      diaVencimento: 1,
      dataInicio: hoje,
      categoryId: '',
      numeroDocumento: '',
      nomeContato: '',
      _partnerId: null,
      observacao: '',
    };
  }

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSubmitting(false);
    if (template) {
      setForm({
        tipo:            template.tipo,
        descricao:       template.descricao || '',
        valor:           template.valor || '',
        frequencia:      template.frequencia,
        diaVencimento:   template.diaVencimento,
        dataInicio:      template.dataInicio?.slice(0, 10) || '',
        categoryId:      template.categoryId || '',
        numeroDocumento: template.numeroDocumento || '',
        nomeContato:     template.nomeContato || '',
        _partnerId:      null,
        observacao:      template.observacao || '',
      });
    } else {
      setForm(emptyForm(tipoLocked));
    }
    // Carrega categorias
    api.get('/categories').then(res => {
      setCategories(res.data.data?.data || res.data.data || []);
    }).catch(() => setCategories([]));
  }, [isOpen, template, tipoLocked]);

  if (!isOpen) return null;

  const isMensal = form.frequencia === 'mensal' || form.frequencia === 'anual';
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Mostrar os radios de tipo:
  //  - Sempre quando estiver editando (mostra qual tipo, desabilitado).
  //  - Ao criar: só quando NÃO há tipoLocked (senão, redundante com a URL).
  const showTipoSelector = isEdit || !tipoLocked;

  // Label do campo "contato": prioriza o label travado pela URL, senão
  // usa o tipo do form (comportamento original).
  const contatoLabel = labels.contatoLabel
    || (form.tipo === 'pagar' ? 'Fornecedor' : 'Cliente');

  const handleSubmit = async () => {
    setError('');
    if (!form.descricao.trim()) return setError('Descrição é obrigatória');
    if (!form.valor || Number(form.valor) <= 0) return setError('Valor inválido');
    if (!form.dataInicio) return setError('Data de início é obrigatória');

    setSubmitting(true);
    try {
      const payload = {
        descricao:       form.descricao.trim(),
        valor:           Number(form.valor),
        categoryId:      form.categoryId || null,
        numeroDocumento: form.numeroDocumento.trim() || null,
        nomeContato:     form.nomeContato.trim() || null,
        observacao:      form.observacao.trim() || null,
      };
      if (!isEdit) {
        // Campos imutáveis só vão na criação
        payload.tipo          = form.tipo;
        payload.frequencia    = form.frequencia;
        payload.diaVencimento = Number(form.diaVencimento);
        payload.dataInicio    = form.dataInicio;
      }

      if (isEdit) {
        await recurringTitlesService.update(template.id, payload);
      } else {
        await recurringTitlesService.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#152740]">
            {isEdit ? labels.modalEdit : labels.modalNew}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Tipo (radio): bloqueado em edição; oculto ao criar com tipoLocked */}
          {showTipoSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
              <div className="flex gap-2">
                {[
                  { value: 'pagar',   label: '📤 A Pagar',   active: 'bg-red-500 text-white border-red-500',     idle: 'border-gray-200 text-gray-600' },
                  { value: 'receber', label: '📥 A Receber', active: 'bg-green-500 text-white border-green-500', idle: 'border-gray-200 text-gray-600' },
                ].map(t => (
                  <button key={t.value} type="button" disabled={isEdit}
                    onClick={() => setField('tipo', t.value)}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-xl transition-colors ${
                      form.tipo === t.value ? t.active : t.idle
                    } ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {isEdit && <p className="text-xs text-gray-400 mt-1">Tipo não pode ser alterado depois de criada.</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input type="text" value={form.descricao}
              onChange={e => setField('descricao', e.target.value)}
              placeholder={labels.descricaoPh}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.valor}
                onChange={e => setField('valor', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={form.categoryId}
                onChange={e => setField('categoryId', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
                <option value="">Selecione…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequência *</label>
              <select value={form.frequencia} disabled={isEdit}
                onChange={e => {
                  const newFreq = e.target.value;
                  setForm(f => ({
                    ...f,
                    frequencia:    newFreq,
                    // Reset diaVencimento pra um valor válido na nova frequência
                    diaVencimento: (newFreq === 'mensal' || newFreq === 'anual') ? 1 : 1,
                  }));
                }}
                className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 ${
                  isEdit ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                {FREQUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isMensal ? 'Dia do mês *' : 'Dia da semana *'}
              </label>
              {isMensal ? (
                <input type="number" min="1" max="31" value={form.diaVencimento} disabled={isEdit}
                  onChange={e => setField('diaVencimento', e.target.value)}
                  className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 ${
                    isEdit ? 'opacity-50 cursor-not-allowed' : ''
                  }`} />
              ) : (
                <select value={form.diaVencimento} disabled={isEdit}
                  onChange={e => setField('diaVencimento', e.target.value)}
                  className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 ${
                    isEdit ? 'opacity-50 cursor-not-allowed' : ''
                  }`}>
                  {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
            <input type="date" value={form.dataInicio} disabled={isEdit}
              onChange={e => setField('dataInicio', e.target.value)}
              className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20 ${
                isEdit ? 'opacity-50 cursor-not-allowed' : ''
              }`} />
            {isEdit && <p className="text-xs text-gray-400 mt-1">Data de início não pode ser alterada depois de criada.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº Documento</label>
              <input type="text" value={form.numeroDocumento}
                onChange={e => setField('numeroDocumento', e.target.value)}
                placeholder="NF, contrato…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
            </div>
            <div>
              <SelectComCadastro
                key={form.tipo}
                label={contatoLabel}
                endpoint={form.tipo === 'pagar' ? '/suppliers' : '/customers'}
                value={form._partnerId}
                onChange={(id, item) => {
                  setField('_partnerId', id);
                  setField('nomeContato', item?.nome || '');
                }}
                getLabel={(it) => it.nome}
                getSubLabel={(it) => it.documento}
                placeholder={form.nomeContato
                  ? `Atual: ${form.nomeContato}`
                  : (form.tipo === 'pagar' ? 'Selecione um fornecedor...' : 'Selecione um cliente...')}
                cadastroFields={[
                  { name: 'nome',          label: 'Nome', required: true },
                  { name: 'tipoDocumento', label: 'Tipo', type: 'select',
                    options: [{ value: 'cnpj', label: 'CNPJ' }, { value: 'cpf', label: 'CPF' }] },
                  { name: 'documento',     label: 'CPF/CNPJ' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea rows={2} value={form.observacao}
              onChange={e => setField('observacao', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting}
            className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors disabled:opacity-60">
            {submitting ? 'Salvando…' : (isEdit ? 'Salvar' : labels.modalNew)}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
