// Importação e conferência da fatura de cartão.
//
// O produto desta etapa é a CONFERÊNCIA: você abre o PDF ao lado e checa se o
// leitor acertou. Por isso a tela mostra, antes de tudo, a soma das linhas
// contra o total impresso na fatura. Se não bater, o leitor errou, e nada
// adiante faria sentido.
//
// Classificação e geração de lançamentos vêm na Etapa 2.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, CreditCard, FileUp, Loader2, Trash2, Upload,
} from 'lucide-react';
import creditCardsService from '../services/creditCardsService';
import useRole from '../hooks/useRole';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/formatters';

const dataBR = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

const TIPO_ESTILO = {
  compra:    { label: 'Compra',    cls: 'bg-slate-100 text-slate-600' },
  estorno:   { label: 'Estorno',   cls: 'bg-emerald-100 text-emerald-700' },
  pagamento: { label: 'Pagamento', cls: 'bg-blue-100 text-blue-700' },
  encargo:   { label: 'Encargo',   cls: 'bg-amber-100 text-amber-700' },
};

// Pagamento e estorno abatem a fatura, então aparecem com sinal negativo.
const ABATE = (tipo) => tipo === 'pagamento' || tipo === 'estorno';

export default function FaturaCartao() {
  const { hasRole } = useRole();
  const [params] = useSearchParams();

  const [cartoes, setCartoes]     = useState([]);
  const [cartaoId, setCartaoId]   = useState(params.get('cartao') || '');
  const [faturas, setFaturas]     = useState([]);
  const [file, setFile]           = useState(null);
  const [enviando, setEnviando]   = useState(false);
  const [erro, setErro]           = useState('');
  const [detalhe, setDetalhe]     = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    creditCardsService.listCards()
      .then((r) => {
        const lista = r.data.data || [];
        setCartoes(lista);
        if (!cartaoId && lista.length === 1) setCartaoId(lista[0].id);
      })
      .catch(() => setCartoes([]));
    // Só na montagem: escolher o cartão depois não deve recarregar a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarFaturas = useCallback(async () => {
    if (!cartaoId) { setFaturas([]); return; }
    try {
      const r = await creditCardsService.listStatements(cartaoId);
      setFaturas(r.data.data || []);
    } catch (_) { setFaturas([]); }
  }, [cartaoId]);

  useEffect(() => { carregarFaturas(); }, [carregarFaturas]);

  async function abrirDetalhe(id) {
    setCarregandoDetalhe(true);
    setErro('');
    try {
      const r = await creditCardsService.findStatement(id);
      setDetalhe(r.data.data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao abrir a fatura.');
    }
    setCarregandoDetalhe(false);
  }

  async function enviar() {
    if (!cartaoId) { setErro('Escolha o cartão.'); return; }
    if (!file)     { setErro('Escolha o PDF da fatura.'); return; }

    setEnviando(true);
    setErro('');
    try {
      const r = await creditCardsService.importStatement(cartaoId, file);
      setFile(null);
      await carregarFaturas();
      await abrirDetalhe(r.data.data.statementId);
    } catch (e) {
      const resp = e.response?.data;
      if (resp?.code === 'FATURA_DUPLICADA' && resp?.data?.existingStatementId) {
        setErro(resp.error);
        abrirDetalhe(resp.data.existingStatementId);
      } else {
        setErro(resp?.error || 'Falha ao importar a fatura.');
      }
    }
    setEnviando(false);
  }

  async function excluir(id) {
    try {
      await creditCardsService.removeStatement(id);
      setConfirmDel(null);
      if (detalhe?.id === id) setDetalhe(null);
      carregarFaturas();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir.');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-lg">Faturas de Cartão</h2>
        <p className="text-sm text-slate-400">
          Suba o PDF da fatura e confira as compras que o sistema separou.
        </p>
      </div>

      {cartoes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão em Cadastros antes de importar faturas."
          />
        </div>
      ) : (
        <>
          {/* Upload */}
          <div className="card p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="input-label">Cartão</label>
                <select className="input-field" value={cartaoId}
                  onChange={(e) => { setCartaoId(e.target.value); setDetalhe(null); }}>
                  <option value="">Selecione...</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.ultimos4 ? ` (final ${c.ultimos4})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">PDF da fatura</label>
                <input type="file" accept=".pdf,application/pdf"
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setErro(''); }}
                  className="input-field file:mr-3 file:py-1 file:px-3 file:rounded-lg
                             file:border-0 file:text-xs file:bg-navy-50 file:text-navy-700" />
              </div>
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 items-start">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{erro}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={enviar} disabled={enviando || !hasRole(1)}
                className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {enviando ? 'Lendo a fatura...' : 'Importar fatura'}
              </button>
            </div>
          </div>

          {/* Faturas já importadas */}
          {faturas.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Vencimento</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Arquivo</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Total</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Linhas</th>
                    <th className="text-right px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50 ${
                      detalhe?.id === f.id ? 'bg-navy-50' : ''
                    }`}>
                      <td className="px-4 py-2">{dataBR(f.dataVencimento)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{f.nomeArquivo || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        {f.valorTotalInformado != null ? formatCurrency(f.valorTotalInformado) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">{f.totalLinhas}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => abrirDetalhe(f.id)}
                          className="text-xs text-navy-700 hover:underline mr-3">Conferir</button>
                        {hasRole(1) && (
                          <button onClick={() => setConfirmDel(f)} title="Excluir"
                            className="text-slate-400 hover:text-red-600 align-middle">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {carregandoDetalhe && (
            <div className="card p-8 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Carregando...
            </div>
          )}

          {/* Conferência */}
          {detalhe && !carregandoDetalhe && <Conferencia f={detalhe} />}

          {!detalhe && !carregandoDetalhe && faturas.length === 0 && cartaoId && (
            <div className="card">
              <EmptyState
                icon={FileUp}
                title="Nenhuma fatura importada"
                description="Suba o PDF da fatura deste cartão para ver as compras separadas."
              />
            </div>
          )}
        </>
      )}

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir fatura" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Excluir a fatura de <strong>{dataBR(confirmDel?.dataVencimento)}</strong> e
            todas as linhas lidas dela?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => excluir(confirmDel.id)} className="btn-danger flex-1">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Conferência de uma fatura
// ─────────────────────────────────────────────────────────────────────────

function Conferencia({ f }) {
  const bate = f.confere === true;
  const semTotal = f.confere === null;

  return (
    <div className="space-y-4">
      {/* A conferência vem PRIMEIRO: se a soma não bate, nada abaixo importa. */}
      <div className={`card p-5 border ${
        semTotal ? 'bg-slate-50 border-slate-200'
          : bate ? 'bg-emerald-50 border-emerald-200'
                 : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-3">
          {semTotal ? <AlertTriangle size={18} className="text-slate-400 mt-0.5" />
            : bate ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
                   : <AlertTriangle size={18} className="text-red-600 mt-0.5" />}
          <div className="flex-1">
            <p className={`font-medium text-sm ${
              semTotal ? 'text-slate-700' : bate ? 'text-emerald-900' : 'text-red-900'
            }`}>
              {semTotal ? 'Não foi possível ler o total da fatura no PDF'
                : bate  ? 'A leitura confere com o total da fatura'
                        : 'A leitura NÃO confere com o total da fatura'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {semTotal
                ? 'Confira a soma abaixo manualmente contra o PDF.'
                : bate
                  ? 'A soma das linhas lidas é igual ao total impresso. Pode confiar na separação.'
                  : 'Alguma linha ficou de fora ou foi lida errado. Não use esta fatura antes de conferir.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/60">
          <Numero rotulo="Total no PDF"
            valor={f.valorTotalInformado != null ? formatCurrency(f.valorTotalInformado) : '—'} />
          <Numero rotulo="Soma das linhas" valor={formatCurrency(f.somaLinhas)} />
          <Numero rotulo="Diferença"
            valor={f.diferenca != null ? formatCurrency(f.diferenca) : '—'}
            destaque={!semTotal && !bate} />
          <Numero rotulo="Vencimento" valor={dataBR(f.dataVencimento)} />
        </div>
      </div>

      {/* Contagem por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TIPO_ESTILO).map(([tipo, est]) => (
          <div key={tipo} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{est.label}s</p>
            <p className="font-display font-semibold text-xl text-navy-800">
              {f.porTipo?.[tipo] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Linhas */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-navy-800 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">{f.creditCard?.nome}</p>
            <p className="text-navy-400 text-xs">
              Lido pelo leitor "{f.emissorDetectado}" · {f.entries?.length || 0} linha(s)
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Data</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Descrição</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Parcela</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Tipo</th>
                <th className="text-right px-4 py-2 text-slate-500 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(f.entries || []).map((e) => {
                const abate = ABATE(e.tipo);
                return (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap">{dataBR(e.dataCompra)}</td>
                    <td className="px-4 py-2 text-navy-800">{e.descricao}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">
                      {e.parcelaNumero ? `${e.parcelaNumero}/${e.parcelaTotal}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${TIPO_ESTILO[e.tipo]?.cls}`}>
                        {TIPO_ESTILO[e.tipo]?.label || e.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${
                      abate ? 'text-emerald-600' : 'text-navy-800'
                    }`}>
                      {abate ? '-' : ''}{formatCurrency(e.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Nesta etapa a fatura é só lida e conferida. A classificação por categoria e a
        geração dos lançamentos vêm na próxima entrega.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor, destaque }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{rotulo}</p>
      <p className={`font-display font-semibold text-base ${
        destaque ? 'text-red-700' : 'text-navy-800'
      }`}>{valor}</p>
    </div>
  );
}
