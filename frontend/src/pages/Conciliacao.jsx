import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ListChecks, ArrowLeft, ChevronRight, Search,
  CheckCircle2, Clock, MinusCircle, Building2, Calendar,
  Link2, Plus, X, Loader2, AlertTriangle, FileText,
  TrendingUp, TrendingDown, RefreshCw, Tag, SlidersHorizontal
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { useCategories } from '../hooks/useFinanceData';
import { formatCurrency } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function dateOnlyBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function dateTimeBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_COR = {
  pendente:   { bg: 'bg-amber-50',    border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  conciliado: { bg: 'bg-emerald-50',  border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-700' },
  ignorado:   { bg: 'bg-slate-50',    border: 'border-slate-200',  text: 'text-slate-500',  badge: 'bg-slate-100 text-slate-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Padrões OFX: match local (mesma regra do backend aplicarSugestoesCategoria)
// ─────────────────────────────────────────────────────────────────────────────

function encontrarPadrao(entry, padroes) {
  if (!padroes || !padroes.length) return null;
  const texto = `${entry.descricao || ''} ${entry.memo || ''}`.toUpperCase();
  if (!texto.trim()) return null;
  return padroes.find(
    (p) => p.textoHistorico && texto.includes(p.textoHistorico.toUpperCase())
  ) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal — roteador entre lista e tela de conciliação
// ─────────────────────────────────────────────────────────────────────────────

export default function Conciliacao() {
  const [params, setParams] = useSearchParams();
  const importId = params.get('importId');

  if (!importId) {
    return <ListaImports onAbrir={(id) => setParams({ importId: id })} />;
  }
  return <TelaConciliacao importId={importId} onVoltar={() => setParams({})} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista de imports — quando entra pela sidebar sem importId
// ─────────────────────────────────────────────────────────────────────────────

function ListaImports({ onAbrir }) {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/ofx/imports?limit=50');
        setImports(data.data?.data || []);
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-lg">Conciliação</h2>
        <p className="text-sm text-slate-400">
          Selecione uma importação OFX para conciliar suas transações.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : imports.length === 0 ? (
        <div className="card p-2">
          <EmptyState
            icon={ListChecks}
            title="Nenhuma importação OFX"
            description="Você precisa importar um extrato OFX antes de conciliar."
            action={
              <button
                onClick={() => navigate('/app/importacao-ofx')}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={14} /> Importar OFX
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {imports.map((imp) => (
            <button
              key={imp.id}
              onClick={() => onAbrir(imp.id)}
              className="card p-4 hover:shadow-md hover:border-navy-200 transition-all
                         w-full text-left group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center
                                justify-center flex-shrink-0">
                  <FileText size={18} className="text-navy-700" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-800 text-sm truncate">
                    {imp.nomeArquivo || 'Arquivo OFX'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <Building2 size={11} />
                    <span>{imp.bankAccount?.nome || '—'}</span>
                    <span className="text-slate-300">·</span>
                    <Calendar size={11} />
                    <span>{dateOnlyBR(imp.dataInicio)} a {dateOnlyBR(imp.dataFim)}</span>
                  </p>
                  <div className="flex gap-2 mt-2 text-[11px] flex-wrap">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded
                                     font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      {imp.conciliados || 0}
                    </span>
                    {(imp.pendentes || 0) > 0 && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded
                                       font-medium flex items-center gap-1">
                        <Clock size={11} />
                        {imp.pendentes} pendente{imp.pendentes === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded">
                      {imp.totalRegistros || 0} reg.
                    </span>
                  </div>
                </div>

                <ChevronRight size={18} className="text-slate-300
                                                    group-hover:text-navy-600 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tela de conciliação — quando há importId
// ─────────────────────────────────────────────────────────────────────────────

function TelaConciliacao({ importId, onVoltar }) {
  const [data, setData] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [filterStatus, setFilterStatus]   = useState('pendente');
  const [searchTerm, setSearchTerm]       = useState('');
  const [busyEntryId, setBusyEntryId]     = useState(null);
  const [bulkBusy, setBulkBusy]           = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);

  const [vincularEntry, setVincularEntry]       = useState(null);
  const [quickCreateEntry, setQuickCreateEntry] = useState(null);
  const [unlinkConfirm, setUnlinkConfirm]       = useState(null);
  const [patternEntry, setPatternEntry]         = useState(null);
  const [padroes, setPadroes]                   = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resp } = await api.get(
        `/ofx/imports/${importId}/entries?status=${filterStatus}`
      );
      setData(resp.data);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao carregar conciliação.');
    }
    setLoading(false);
  }, [importId, filterStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarPadroes = useCallback(async () => {
    try {
      const { data: resp } = await api.get('/ofx-patterns');
      setPadroes(resp.data || resp.data?.data || []);
    } catch (_) { /* sem padrões ou sem permissão: ignora */ }
  }, []);

  useEffect(() => { carregarPadroes(); }, [carregarPadroes]);

  const entriesFiltradas = useMemo(() => {
    if (!data?.entries) return [];
    const t = searchTerm.trim().toLowerCase();
    if (!t) return data.entries;
    return data.entries.filter((e) =>
      (e.descricao || '').toLowerCase().includes(t) ||
      (e.memo || '').toLowerCase().includes(t)
    );
  }, [data, searchTerm]);

  async function ignorar(entry) {
    setBusyEntryId(entry.id);
    try {
      await api.post(`/ofx/entries/${entry.id}/ignore`);
      carregar();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao ignorar.');
    }
    setBusyEntryId(null);
  }

  async function desfazerIgnorar(entry) {
    setBusyEntryId(entry.id);
    try {
      await api.post(`/ofx/entries/${entry.id}/unignore`);
      carregar();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao desfazer.');
    }
    setBusyEntryId(null);
  }

  async function desvincular() {
    if (!unlinkConfirm) return;
    setBusyEntryId(unlinkConfirm.id);
    try {
      await api.post(`/ofx/entries/${unlinkConfirm.id}/unlink`);
      setUnlinkConfirm(null);
      carregar();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao desvincular.');
    }
    setBusyEntryId(null);
  }

  async function bulkConciliarPendentes() {
    if (!summary?.pendente) return;
    const ok = window.confirm(
      `Criar ${summary.pendente} lançamento(s) a partir das pendências?\n\n` +
      `Cada entry virará um lançamento conciliado, usando a categoria sugerida (ou "sem categoria"). ` +
      `Você pode ajustar depois em Lançamentos.`
    );
    if (!ok) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const { data: resp } = await api.post(`/ofx/imports/${importId}/bulk-create`);
      setBulkResult(resp.data);
      await carregar();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao conciliar em massa.');
    }
    setBulkBusy(false);
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-slate-100 rounded animate-pulse w-1/3" />
        <div className="card p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { import: imp, summary } = data;

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div>
        <button
          onClick={onVoltar}
          className="text-xs text-slate-500 hover:text-navy-700 flex items-center gap-1 mb-2"
        >
          <ArrowLeft size={12} /> Importações OFX
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-semibold text-navy-800 text-lg break-all">
              {imp.nomeArquivo || 'Arquivo OFX'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Building2 size={12} />
              {imp.bankAccount?.nome || '—'}
              <span className="text-slate-300">·</span>
              <Calendar size={12} />
              {dateOnlyBR(imp.dataInicio)} a {dateOnlyBR(imp.dataFim)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Importado em {dateTimeBR(imp.importadoEm)}
              {imp.importador?.nome && ` por ${imp.importador.nome}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {summary?.pendente > 0 && (
              <button
                onClick={bulkConciliarPendentes}
                disabled={bulkBusy}
                className="px-3 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-800 disabled:opacity-60
                           text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Cria lançamentos automaticamente para todas as pendências"
              >
                {bulkBusy
                  ? (<><Loader2 size={12} className="animate-spin"/> Conciliando...</>)
                  : (<><CheckCircle2 size={12}/> Conciliar todas ({summary.pendente})</>)
                }
              </button>
            )}
            <button
              onClick={carregar}
              className="text-xs text-slate-500 hover:text-navy-700 flex items-center gap-1"
              title="Atualizar"
            >
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {bulkResult && (
        <div className="card border-emerald-200 bg-emerald-50 px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 mt-0.5"/>
          <div className="flex-1">
            <p className="text-emerald-800 font-medium">
              {bulkResult.created} lançamento(s) criado(s){bulkResult.errors > 0 ? `, ${bulkResult.errors} com erro` : ''}.
            </p>
            {bulkResult.errors > 0 && (
              <p className="text-xs text-emerald-700 mt-0.5">
                Reveja as pendências que sobraram.
              </p>
            )}
          </div>
          <button onClick={() => setBulkResult(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Tabs por status */}
      <div className="card p-1 flex gap-1">
        {[
          { id: 'pendente',   label: 'Pendentes',   icon: Clock,         count: summary.pendente   },
          { id: 'conciliado', label: 'Conciliadas', icon: CheckCircle2,  count: summary.conciliado },
          { id: 'ignorado',   label: 'Ignoradas',   icon: MinusCircle,   count: summary.ignorado   },
        ].map((t) => {
          const Icon = t.icon;
          const active = filterStatus === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilterStatus(t.id)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                          transition-colors flex items-center justify-center gap-2
                          ${active
                            ? 'bg-navy-700 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                          }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold
                              ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtro de busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filtrar por descrição ou memo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-9 text-sm w-full"
        />
      </div>

      {/* Lista de entries */}
      {entriesFiltradas.length === 0 ? (
        <div className="card p-2">
          <EmptyState
            icon={filterStatus === 'pendente' ? CheckCircle2 : ListChecks}
            title={
              filterStatus === 'pendente' && summary.pendente === 0
                ? 'Tudo conciliado! 🎉'
                : 'Nenhuma entry nesta categoria'
            }
            description={
              filterStatus === 'pendente' && summary.pendente === 0
                ? 'Todas as transações deste extrato foram conciliadas.'
                : searchTerm
                  ? 'Nenhuma entry corresponde à sua busca.'
                  : `Nenhuma entry com status "${filterStatus}".`
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {entriesFiltradas.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              busy={busyEntryId === entry.id}
              onVincular={() => setVincularEntry(entry)}
              onCriar={() => setQuickCreateEntry(entry)}
              onIgnorar={() => ignorar(entry)}
              onDesfazerIgnorar={() => desfazerIgnorar(entry)}
              onDesvincular={() => setUnlinkConfirm(entry)}
              padroes={padroes}
              onPadrao={() => setPatternEntry(entry)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {vincularEntry && (
        <VincularModal
          entry={vincularEntry}
          onClose={() => setVincularEntry(null)}
          onLinked={() => { setVincularEntry(null); carregar(); }}
        />
      )}

      {quickCreateEntry && (
        <QuickCreateModal
          entry={quickCreateEntry}
          padroes={padroes}
          onClose={() => setQuickCreateEntry(null)}
          onCreated={() => { setQuickCreateEntry(null); carregar(); }}
        />
      )}

      {patternEntry && (
        <PatternModal
          entry={patternEntry}
          padroes={padroes}
          onClose={() => setPatternEntry(null)}
          onSaved={() => {
            setPatternEntry(null);
            carregarPadroes();
            carregar();
          }}
        />
      )}

      <Modal
        open={!!unlinkConfirm}
        onClose={() => setUnlinkConfirm(null)}
        title="Desvincular conciliação"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja desvincular esta entry do lançamento?
          </p>
          <p className="text-xs text-slate-500">
            A entry voltará ao status <strong>pendente</strong> e o lançamento perderá
            a marcação de "conciliado".
          </p>
          <div className="flex gap-3">
            <button onClick={() => setUnlinkConfirm(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={desvincular} className="btn-danger flex-1">
              Desvincular
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de uma entry — variações por status
// ─────────────────────────────────────────────────────────────────────────────

function EntryCard({ entry, busy, onVincular, onCriar, onIgnorar, onDesfazerIgnorar, onDesvincular, padroes = [], onPadrao }) {
  const padraoCasado = encontrarPadrao(entry, padroes);
  const cor = STATUS_COR[entry.status] || STATUS_COR.pendente;
  const isCredito = entry.tipo === 'credito';
  const Icon = isCredito ? TrendingUp : TrendingDown;
  const valorCor = isCredito ? 'text-emerald-600' : 'text-red-500';
  const sinal = isCredito ? '+' : '−';

  const memo = entry.memo || entry.descricao || '(sem descrição)';

  return (
    <div className={`card border ${cor.border} ${entry.status === 'ignorado' ? 'opacity-60' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">

          {/* Ícone do tipo */}
          <div className={`w-9 h-9 rounded-full ${cor.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={15} className={valorCor} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {dateOnlyBR(entry.dataMovimento)}
              </span>
              <span className={`font-semibold text-base ${valorCor}`}>
                {sinal} {formatCurrency(entry.valor)}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${cor.badge}`}>
                {entry.status === 'pendente'   && 'Pendente'}
                {entry.status === 'conciliado' && 'Conciliada'}
                {entry.status === 'ignorado'   && 'Ignorada'}
              </span>
            </div>

            <p className="text-sm text-navy-800 mt-1 break-words">
              {memo}
            </p>

            {/* Sugestão de categoria (só pendentes) */}
            {entry.status === 'pendente' && entry.suggestedCategory && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Tag size={11} />
                Sugestão: <span className="font-medium text-navy-700">{entry.suggestedCategory.nome}</span>
              </div>
            )}

            {entry.status === 'pendente' && padraoCasado && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-indigo-500">
                <SlidersHorizontal size={11} />
                Padrão ativo:{' '}
                <span className="font-medium text-indigo-700">
                  {padraoCasado.category?.nome || 'sem categoria'}
                </span>
              </div>
            )}

            {/* Lançamento vinculado (só conciliadas) */}
            {entry.status === 'conciliado' && entry.transaction && (
              <div className="mt-2 ml-3 pl-3 border-l-2 border-emerald-200">
                <p className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1">
                  <Link2 size={10} /> Vinculada a:
                </p>
                <p className="text-xs font-medium text-navy-800">
                  {entry.transaction.descricao}
                </p>
                <p className="text-[11px] text-slate-500">
                  {dateOnlyBR(entry.transaction.dataLancamento)}
                  {entry.transaction.category && (
                    <> · {entry.transaction.category.nome}</>
                  )}
                  {entry.transaction.origem === 'ofx' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px]">
                      criado por esta entry
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            {entry.status === 'pendente' && (
              <>
                <button
                  onClick={onVincular}
                  disabled={busy}
                  className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50"
                  title="Vincular a um lançamento existente"
                >
                  <Link2 size={11} /> Vincular
                </button>
                <button
                  onClick={onCriar}
                  disabled={busy}
                  className="btn-primary text-xs flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50"
                  title="Criar lançamento novo a partir desta entry"
                >
                  <Plus size={11} /> Criar lançamento
                </button>
                <button
                  onClick={onPadrao}
                  disabled={busy}
                  className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50"
                  title={padraoCasado ? 'Editar o padrão OFX deste histórico' : 'Criar um padrão OFX para este histórico'}
                >
                  <SlidersHorizontal size={11} />
                  {padraoCasado ? 'Editar padrão' : 'Padrão'}
                </button>
                <button
                  onClick={onIgnorar}
                  disabled={busy}
                  className="text-[11px] text-slate-400 hover:text-slate-700
                             px-2 py-1 transition-colors disabled:opacity-50"
                  title="Esta entry não vai virar lançamento"
                >
                  Ignorar
                </button>
              </>
            )}

            {entry.status === 'conciliado' && (
              <button
                onClick={onDesvincular}
                disabled={busy}
                className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50"
              >
                <X size={11} /> Desvincular
              </button>
            )}

            {entry.status === 'ignorado' && (
              <button
                onClick={onDesfazerIgnorar}
                disabled={busy}
                className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50"
              >
                <RefreshCw size={11} /> Desfazer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de vincular — mostra candidatos próximos + busca livre
// ─────────────────────────────────────────────────────────────────────────────

function VincularModal({ entry, onClose, onLinked }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);

  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);

  const [linkingId, setLinkingId]   = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');

  // Carrega candidatos próximos ao abrir
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/ofx/entries/${entry.id}/match-candidates`);
        setCandidates(data.data?.candidatos || []);
      } catch (_) {}
      setLoading(false);
    })();
  }, [entry.id]);

  // Busca livre (com debounce)
  useEffect(() => {
    if (!showSearch) return;
    const t = searchTerm.trim();
    if (t.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelado = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          bankAccountId: entry.bankAccountId,
          search: t,
          limit: 30,
        });
        const tipoTransaction = entry.tipo === 'credito' ? 'receita' : 'despesa';
        params.set('tipo', tipoTransaction);

        const { data } = await api.get(`/transactions?${params}`);
        const items = (data.data?.data || data.data?.transactions || [])
          .filter((t) => !t.conciliadoEm); // só não-conciliados
        if (!cancelado) setSearchResults(items);
      } catch (_) {
        if (!cancelado) setSearchResults([]);
      }
      if (!cancelado) setSearching(false);
    }, 350);

    return () => { cancelado = true; clearTimeout(handle); };
  }, [searchTerm, showSearch, entry.bankAccountId, entry.tipo]);

  async function vincular(transactionId) {
    setLinkingId(transactionId);
    setErrorMsg('');
    try {
      await api.post(`/ofx/entries/${entry.id}/link`, { transactionId });
      onLinked();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao vincular.');
    }
    setLinkingId(null);
  }

  const isCredito = entry.tipo === 'credito';
  const memo = entry.memo || entry.descricao || '(sem descrição)';

  return (
    <Modal open onClose={onClose} title="Vincular a um lançamento existente" size="lg">
      <div className="space-y-4">

        {/* Origem (entry OFX) */}
        <div className="bg-navy-50 border border-navy-100 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-navy-500 font-semibold mb-1">
            Linha do extrato OFX
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xs text-slate-600">{dateOnlyBR(entry.dataMovimento)}</span>
            <span className={`font-semibold text-base ${isCredito ? 'text-emerald-600' : 'text-red-500'}`}>
              {isCredito ? '+' : '−'} {formatCurrency(entry.valor)}
            </span>
          </div>
          <p className="text-xs text-navy-700 mt-1">{memo}</p>
        </div>

        {/* Candidatos próximos */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Candidatos próximos (mesma conta, valor ±10%, data ±5 dias)
          </p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-lg">
              Nenhum lançamento próximo encontrado.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  loading={linkingId === c.id}
                  onSelect={() => vincular(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Busca livre — toggle */}
        {!showSearch ? (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full text-xs text-slate-500 hover:text-navy-700 py-2 border border-dashed
                       border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Não achou? Buscar outro lançamento...
          </button>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por descrição (mín. 2 caracteres)..."
                className="input-field pl-9 text-sm w-full"
                autoFocus
              />
              {searching && (
                <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              )}
            </div>

            {searchTerm.trim().length >= 2 && (
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {searchResults.length === 0 && !searching ? (
                  <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-lg">
                    Nenhum lançamento encontrado.
                  </div>
                ) : (
                  searchResults.map((c) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      loading={linkingId === c.id}
                      onSelect={() => vincular(c.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 items-start">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

function CandidateRow({ candidate, loading, onSelect }) {
  const matchPerfeito = (() => {
    if (!candidate._distancia) return false;
    return candidate._distancia.dias === 0 && candidate._distancia.valorPct < 0.001;
  })();

  return (
    <div className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg
                    hover:border-navy-200 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{dateOnlyBR(candidate.dataLancamento)}</span>
          <span className="text-sm font-semibold text-navy-800">
            {formatCurrency(candidate.valor)}
          </span>
          {matchPerfeito && (
            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-medium">
              match exato
            </span>
          )}
        </div>
        <p className="text-xs text-slate-700 truncate mt-0.5">
          {candidate.descricao || '(sem descrição)'}
        </p>
        {candidate.category && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {candidate.category.nome}
          </p>
        )}
      </div>
      <button
        onClick={onSelect}
        disabled={loading}
        className="btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50 flex items-center gap-1"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
        Vincular
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de quick-create — cria Transaction nova a partir da entry
// ─────────────────────────────────────────────────────────────────────────────

function QuickCreateModal({ entry, onClose, onCreated, padroes = [] }) {
  const { categorias } = useCategories();

  const isCredito = entry.tipo === 'credito';
  const tipoTransaction = isCredito ? 'receita' : 'despesa';

  // Filtra categorias compatíveis com o tipo
  // Category.tipo é 'receita' | 'despesa' | 'ambos'
  // Category.natureza é 'fixa' | 'variavel' (não tem a ver com receita/despesa)
  const categoriasFiltradas = useMemo(() => {
    if (!categorias) return [];
    return categorias.filter((c) =>
      !c.tipo || c.tipo === tipoTransaction || c.tipo === 'ambos' || c.tipo === 'transferencia'
    );
  }, [categorias, tipoTransaction]);

  const [descricao, setDescricao]   = useState(entry.memo || entry.descricao || '');
  const [complemento, setComplemento] = useState(
    entry.descricao && entry.memo && entry.descricao !== entry.memo ? entry.memo : ''
  );
  const padraoCasado = useMemo(() => encontrarPadrao(entry, padroes), [entry, padroes]);
  const [categoryId, setCategoryId] = useState(
    entry.suggestedCategoryId || padraoCasado?.categoryId || ''
  );
  const [saving, setSaving]         = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');

  async function salvar() {
    if (!descricao.trim()) {
      setErrorMsg('Descrição obrigatória.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await api.post(`/ofx/entries/${entry.id}/quick-create`, {
        categoryId:  categoryId || null,
        descricao:   descricao.trim(),
        complemento: complemento.trim() || null,
      });
      onCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao criar lançamento.');
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={!saving ? onClose : undefined}
           title="Criar lançamento a partir do extrato" size="md">
      <div className="space-y-4">

        {/* Origem (entry OFX) */}
        <div className="bg-navy-50 border border-navy-100 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-navy-500 font-semibold mb-1">
            Origem · linha do extrato OFX
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xs text-slate-600">{dateOnlyBR(entry.dataMovimento)}</span>
            <span className={`font-semibold text-base ${isCredito ? 'text-emerald-600' : 'text-red-500'}`}>
              {isCredito ? '+' : '−'} {formatCurrency(entry.valor)}
            </span>
          </div>
          <p className="text-xs text-navy-700 mt-1">
            {entry.memo || entry.descricao || '(sem descrição)'}
          </p>
        </div>

        {/* Campos auto */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Tipo</p>
            <p className="font-medium text-navy-700 capitalize">{tipoTransaction}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Valor</p>
            <p className="font-medium text-navy-700">{formatCurrency(entry.valor)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Data</p>
            <p className="font-medium text-navy-700">{dateOnlyBR(entry.dataMovimento)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Status</p>
            <p className="font-medium text-emerald-600">Realizado</p>
          </div>
        </div>

        {/* Campos editáveis */}
        <div className="space-y-3">
          <div>
            <label className="input-label">Descrição *</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input-field text-sm"
              maxLength={500}
              disabled={saving}
            />
          </div>

          <div>
            <label className="input-label">Complemento (opcional)</label>
            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="input-field text-sm"
              maxLength={500}
              disabled={saving}
            />
          </div>

          <div>
            <label className="input-label">
              Categoria
              {entry.suggestedCategory && (
                <span className="ml-1 text-[10px] text-slate-400 font-normal">
                  (sugestão: {entry.suggestedCategory.nome})
                </span>
              )}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field text-sm"
              disabled={saving}
            >
              <option value="">— Sem categoria —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 items-start">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Criando...</>
            ) : (
              <>Criar e conciliar</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Modal de Padrão OFX — cria ou edita o padrão (histórico -> categoria) que
// casa com o histórico deste item do extrato.
// ─────────────────────────────────────────────────────────────────────────────
function PatternModal({ entry, padroes, onClose, onSaved }) {
  const { categorias } = useCategories();

  // Lista local de categorias (permite refletir categoria recém-criada
  // sem depender de reload do hook compartilhado).
  const [categoriasLocais, setCategoriasLocais] = useState([]);
  useEffect(() => { setCategoriasLocais(categorias || []); }, [categorias]);

  // Estado do criador de categoria inline.
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCatNome, setNovaCatNome]           = useState('');
  const [novaCatTipo, setNovaCatTipo]           = useState(
    entry.tipo === 'credito' ? 'receita' : 'despesa'
  );
  const [novaCatNatureza, setNovaCatNatureza]   = useState('variavel');
  const [salvandoCat, setSalvandoCat]           = useState(false);
  const [catErro, setCatErro]                   = useState('');

  async function criarCategoria() {
    if (!novaCatNome.trim()) {
      setCatErro('Informe o nome da categoria.');
      return;
    }
    setSalvandoCat(true);
    setCatErro('');
    try {
      const { data: resp } = await api.post('/categories', {
        nome: novaCatNome.trim(),
        tipo: novaCatTipo,
        natureza: novaCatNatureza,
      });
      const nova = resp.data || resp;
      setCategoriasLocais((prev) => [...prev, nova].sort(
        (a, b) => (a.nome || '').localeCompare(b.nome || '')
      ));
      setCategoryId(nova.id);
      setCriandoCategoria(false);
      setNovaCatNome('');
    } catch (err) {
      setCatErro(err.response?.data?.error || 'Erro ao criar categoria.');
    }
    setSalvandoCat(false);
  }

  const existente = useMemo(
    () => encontrarPadrao(entry, padroes),
    [entry, padroes]
  );
  const isEdicao = !!existente;

  const textoSugerido = (entry.memo || entry.descricao || '').trim();

  const [textoHistorico, setTextoHistorico] = useState(
    existente?.textoHistorico || textoSugerido
  );
  const [categoryId, setCategoryId] = useState(
    existente?.categoryId || entry.suggestedCategoryId || ''
  );
  const [complementoAuto, setComplementoAuto] = useState(
    existente?.complementoAuto || ''
  );
  const [saving, setSaving]     = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pré-visualização: o texto digitado casa com o histórico deste item?
  const casa = useMemo(() => {
    const t = textoHistorico.trim().toUpperCase();
    if (!t) return false;
    const alvo = `${entry.descricao || ''} ${entry.memo || ''}`.toUpperCase();
    return alvo.includes(t);
  }, [textoHistorico, entry]);

  async function salvar() {
    if (!textoHistorico.trim()) {
      setErrorMsg('Informe o texto do histórico que identifica o padrão.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        textoHistorico: textoHistorico.trim(),
        categoryId: categoryId || null,
        complementoAuto: complementoAuto.trim() || null,
      };
      if (isEdicao) {
        await api.put(`/ofx-patterns/${existente.id}`, payload);
      } else {
        await api.post('/ofx-patterns', payload);
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Erro ao salvar o padrão.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={!saving ? onClose : undefined}
      title={isEdicao ? 'Editar padrão OFX' : 'Novo padrão OFX'}
      size="md"
    >
      <div className="space-y-4">
        {/* Histórico do item de referência */}
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[11px] text-slate-400 mb-0.5">Histórico do extrato</p>
          <p className="text-sm text-navy-800 break-words">
            {entry.memo || entry.descricao || '(sem descrição)'}
          </p>
        </div>

        {/* Texto do histórico (gatilho do padrão) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Texto que identifica o padrão
          </label>
          <input
            type="text"
            value={textoHistorico}
            onChange={(e) => setTextoHistorico(e.target.value)}
            className="input w-full text-sm"
            placeholder="Ex: TARIFA, PIX RECEBIDA FULANO, BOLETO SIEG..."
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Qualquer extrato cujo histórico <strong>contenha</strong> este texto receberá a
            categoria abaixo como sugestão na importação.
          </p>
          {textoHistorico.trim() && (
            <p className={`mt-1 text-[11px] ${casa ? 'text-emerald-600' : 'text-amber-600'}`}>
              {casa
                ? '✓ Este texto casa com o histórico deste item.'
                : '⚠ Este texto não casa com o histórico deste item.'}
            </p>
          )}
        </div>

        {/* Categoria (com criação inline) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-600">
              Categoria sugerida
            </label>
            {!criandoCategoria && (
              <button
                type="button"
                onClick={() => setCriandoCategoria(true)}
                className="text-[11px] text-navy-600 hover:text-navy-800 flex items-center gap-1"
              >
                <Plus size={11} /> Nova categoria
              </button>
            )}
          </div>

          {!criandoCategoria ? (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">— Sem categoria —</option>
              {(categoriasLocais || []).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          ) : (
            <div className="border border-navy-200 rounded-lg p-3 space-y-2 bg-navy-50/40">
              <input
                type="text"
                value={novaCatNome}
                onChange={(e) => setNovaCatNome(e.target.value)}
                className="input w-full text-sm"
                placeholder="Nome da categoria"
                autoFocus
              />
              <div className="flex gap-2">
                <select
                  value={novaCatTipo}
                  onChange={(e) => setNovaCatTipo(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                  <option value="ambos">Ambos</option>
                  <option value="transferencia">Transferência</option>
                </select>
                <select
                  value={novaCatNatureza}
                  onChange={(e) => setNovaCatNatureza(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  <option value="variavel">Variável</option>
                  <option value="fixa">Fixa</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-400">
                Você pode completar contas contábeis e centros de custo depois, na tela de Categorias.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCriandoCategoria(false); setNovaCatNome(''); setCatErro(''); }}
                  disabled={salvandoCat}
                  className="btn-secondary text-xs flex-1 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarCategoria}
                  disabled={salvandoCat}
                  className="btn-primary text-xs flex-1 flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {salvandoCat && <Loader2 size={12} className="animate-spin" />}
                  Criar e usar
                </button>
              </div>
              {catErro && (
                <p className="text-[11px] text-red-600">{catErro}</p>
              )}
            </div>
          )}
        </div>

        {/* Complemento automático (opcional) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Complemento automático <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={complementoAuto}
            onChange={(e) => setComplementoAuto(e.target.value)}
            className="input w-full text-sm"
            placeholder="Texto fixo a preencher no complemento do lançamento"
          />
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdicao ? 'Salvar alterações' : 'Criar padrão'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
