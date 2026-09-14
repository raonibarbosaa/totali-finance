// frontend/src/components/ui/AjusteSaldoModal.jsx
//
// Ajuste de saldo bancário, com painel de controle dos ajustes já feitos.
//
// O modal tem duas metades:
//
//   1. O PAINEL, no topo: todo ajuste que já foi feito nesta conta, quando foi
//      feito e por quem, e o que ainda dá para fazer com ele — editar, cancelar
//      ou estornar. Quem decide quais botões aparecem é o backend, que devolve
//      um campo `acoes` em cada ajuste; a tela não tem como saber se a
//      competência está fechada.
//
//   2. O FORMULÁRIO de um ajuste novo, embaixo. Quando a conta já tem ajuste
//      valendo, ele começa recolhido — quem abre o modal para corrigir um
//      ajuste antigo não deve esbarrar num campo que cria outro.
//
// O fluxo de criação é deliberadamente lento numa etapa: escolhe-se a data, o
// sistema mostra QUANTO ELE ACHA que a conta tem naquele dia, e só então se
// digita o saldo real do extrato. A diferença aparece por extenso antes de
// confirmar, para ninguém ajustar no automático.

import { useCallback, useEffect, useState } from 'react';
import {
  History, Pencil, Plus, RotateCcw, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import Modal from './Modal';
import balanceAdjustmentsService from '../../services/balanceAdjustmentsService';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

const MOTIVO_MIN = 10;
const hojeISO = () => new Date().toISOString().slice(0, 10);
const isoDe   = (d) => new Date(d).toISOString().slice(0, 10);

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Diferença entre o saldo do extrato e o do sistema, ou null se falta dado. */
function calcularDiferenca(saldoSistema, informado) {
  if (saldoSistema === undefined || saldoSistema === null) return null;
  if (informado === null || !Number.isFinite(informado)) return null;
  return Number((informado - saldoSistema).toFixed(2));
}

/** Faixa colorida com a frase do que vai acontecer. Usada na criação e na edição. */
function ResumoDiferenca({ diferenca, saldoSistema, informado }) {
  if (diferenca === null) return null;

  const cor = diferenca === 0 ? 'bg-slate-50 border-slate-200'
    : diferenca > 0 ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200';

  return (
    <div className={`rounded-xl p-3 border flex items-start gap-3 ${cor}`}>
      {diferenca > 0 ? <TrendingUp size={18} className="text-emerald-600 mt-0.5" />
        : diferenca < 0 ? <TrendingDown size={18} className="text-red-600 mt-0.5" /> : null}
      <div className="text-sm">
        {diferenca === 0 ? (
          <span className="text-slate-600">
            O saldo do sistema já é igual ao saldo informado. Não há o que ajustar.
          </span>
        ) : (
          <>
            <p className={`font-semibold ${diferenca > 0 ? 'text-emerald-800' : 'text-red-800'}`}>
              {diferenca > 0 ? 'Entrada' : 'Saída'} de {formatCurrency(Math.abs(diferenca))}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              O saldo da conta passa de {formatCurrency(saldoSistema)} para {formatCurrency(informado)}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Etiqueta de estado do ajuste, para bater o olho e saber o que é aquela linha. */
function Etiqueta({ ajuste }) {
  const base = 'ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium align-middle';

  if (ajuste.cancelado) return <span className={`${base} bg-slate-200 text-slate-600`}>cancelado</span>;
  if (ajuste.estornoDe) return <span className={`${base} bg-slate-100 text-slate-500`}>estorno</span>;
  if (ajuste.estornado) return <span className={`${base} bg-amber-100 text-amber-700`}>estornado</span>;
  if (ajuste.competenciaFechada) {
    return <span className={`${base} bg-slate-100 text-slate-500`}>mês fechado</span>;
  }
  return <span className={`${base} bg-emerald-100 text-emerald-700`}>vigente</span>;
}

export default function AjusteSaldoModal({ open, conta, onClose, onSaved }) {
  // ── Formulário do ajuste novo ─────────────────────────────────────────
  const [data,      setData]      = useState(hojeISO());
  const [saldoReal, setSaldoReal] = useState('');
  const [motivo,    setMotivo]    = useState('');
  const [previa,    setPrevia]    = useState(null);
  const [criando,   setCriando]   = useState(false);   // seção aberta?

  const [carregando, setCarregando] = useState(false);
  const [salvando,   setSalvando]   = useState(false);
  const [erro,       setErro]       = useState('');

  // ── Painel ────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([]);
  const [aberto,    setAberto]    = useState(null);  // { id, modo, ...campos }
  const [previaEd,  setPreviaEd]  = useState(null);  // prévia da edição em curso
  const [verRevisoes, setVerRevisoes] = useState(null);

  // Recomeça do zero a cada abertura, para não herdar dados de outra conta.
  useEffect(() => {
    if (!open) return;
    setData(hojeISO());
    setSaldoReal('');
    setMotivo('');
    setPrevia(null);
    setErro('');
    setAberto(null);
    setPreviaEd(null);
    setVerRevisoes(null);
  }, [open, conta?.id]);

  const buscarPrevia = useCallback(async () => {
    if (!open || !conta?.id || !data) return;
    setCarregando(true);
    setErro('');
    try {
      const r = await balanceAdjustmentsService.previa(conta.id, data);
      setPrevia(r.data.data);
    } catch (e) {
      setErro(e.response?.data?.error || 'Não foi possível calcular o saldo nesta data');
      setPrevia(null);
    } finally {
      setCarregando(false);
    }
  }, [open, conta?.id, data]);

  useEffect(() => { buscarPrevia(); }, [buscarPrevia]);

  const carregarHistorico = useCallback(async () => {
    if (!conta?.id) return;
    try {
      const r = await balanceAdjustmentsService.list(conta.id);
      const lista = r.data.data || [];
      setHistorico(lista);
      // Conta sem nenhum ajuste valendo já abre no formulário: não há o que
      // controlar, e o usuário veio justamente ajustar.
      setCriando(lista.filter((a) => !a.cancelado).length === 0);
    } catch (_) {
      setHistorico([]);
      setCriando(true);
    }
  }, [conta?.id]);

  useEffect(() => { if (open) carregarHistorico(); }, [open, carregarHistorico]);

  // Prévia da EDIÇÃO: o saldo do sistema na data escolhida, como estaria se o
  // ajuste que está sendo editado não existisse.
  useEffect(() => {
    if (aberto?.modo !== 'editar' || !conta?.id || !aberto.data) { setPreviaEd(null); return; }
    let descartado = false;
    (async () => {
      try {
        const r = await balanceAdjustmentsService.previa(conta.id, aberto.data, aberto.id);
        if (!descartado) setPreviaEd(r.data.data);
      } catch (_) {
        if (!descartado) setPreviaEd(null);
      }
    })();
    return () => { descartado = true; };
  }, [aberto?.modo, aberto?.id, aberto?.data, conta?.id]);

  if (!open || !conta) return null;

  // ── Criação ───────────────────────────────────────────────────────────
  const saldoSistema = previa?.saldoSistema;
  const informado    = num(saldoReal);
  const diferenca    = calcularDiferenca(saldoSistema, informado);

  const sentido   = diferenca === null || diferenca === 0 ? null : diferenca > 0 ? 'entrada' : 'saida';
  const categoria = sentido ? previa?.categorias?.[sentido] : null;

  const motivoOk   = motivo.trim().length >= MOTIVO_MIN;
  const podeSalvar = !!previa && diferenca !== null && diferenca !== 0 && motivoOk && !salvando;

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await balanceAdjustmentsService.create({
        bankAccountId:  conta.id,
        dataLancamento: data,
        saldoReal:      informado,
        motivo:         motivo.trim(),
      });
      setSaldoReal('');
      setMotivo('');
      await carregarHistorico();
      await buscarPrevia();
      onSaved?.();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao ajustar o saldo');
    } finally {
      setSalvando(false);
    }
  }

  // ── Ações do painel ───────────────────────────────────────────────────
  async function executar(fn) {
    setSalvando(true);
    setErro('');
    try {
      await fn();
      setAberto(null);
      await carregarHistorico();
      await buscarPrevia();
      onSaved?.();
    } catch (e) {
      setErro(e.response?.data?.error || 'Não foi possível concluir a operação');
    } finally {
      setSalvando(false);
    }
  }

  const salvarEdicao = (a) => executar(() => balanceAdjustmentsService.atualizar(a.id, {
    dataLancamento: aberto.data,
    saldoReal:      num(aberto.saldoReal),
    motivo:         aberto.motivo.trim(),
  }));

  const confirmarCancelamento = (a) =>
    executar(() => balanceAdjustmentsService.cancelar(a.id, aberto.motivo.trim()));

  const confirmarEstorno = (a) =>
    executar(() => balanceAdjustmentsService.estornar(a.id, aberto.motivo.trim()));

  const ativos = historico.filter((a) => !a.cancelado);

  return (
    <Modal open={open} onClose={salvando ? () => {} : onClose}
           title={`Ajuste de saldo — ${conta.nome}`} size="lg">
      <div className="space-y-4">

        {/* Explicação do que o ajuste faz. Evita o uso como atalho para
            "sumir com" uma diferença sem entender a causa. */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          O ajuste cria um lançamento no valor da diferença e fica registrado com
          seu nome e o motivo. Ele entra no saldo e no extrato, mas <strong>não</strong> vai
          para o DRE, o DFC nem a exportação do Domínio. A data do ajuste também vira
          um <strong>marco de corte</strong>: ao importar um extrato que alcance datas
          anteriores a ela, os lançamentos desse período são desconsiderados.
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {erro}
          </div>
        )}

        {/* ── Painel de ajustes ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <History size={14} className="text-slate-400" />
            <h4 className="text-sm font-semibold text-navy-800">Ajustes desta conta</h4>
            <span className="text-xs text-slate-400">
              {ativos.length} em vigor
              {historico.length > ativos.length &&
                `, ${historico.length - ativos.length} cancelado(s)`}
            </span>
          </div>

          {historico.length === 0 ? (
            <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3">
              Nenhum ajuste foi feito nesta conta.
            </p>
          ) : (
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
              {historico.map((a) => {
                const dif      = Number(a.diferenca);
                const editando = aberto?.id === a.id && aberto.modo === 'editar';
                const emAcao   = aberto?.id === a.id;

                return (
                  <div key={a.id}
                       className={`border rounded-lg p-3 text-xs ${
                         a.cancelado ? 'border-slate-100 bg-slate-50/60' : 'border-slate-200'}`}>

                    {/* Cabeçalho: o que foi ajustado, quando e por quem */}
                    <div className="flex items-start justify-between gap-3">
                      <div className={a.cancelado ? 'opacity-60' : ''}>
                        <p className="font-medium text-navy-800">
                          <span className={a.cancelado ? 'line-through' : ''}>
                            {formatDate(a.dataAjuste)}
                          </span>
                          <span className={`ml-2 ${dif > 0 ? 'text-emerald-600' : 'text-red-600'} ${
                            a.cancelado ? 'line-through' : ''}`}>
                            {dif > 0 ? '+' : ''}{formatCurrency(dif)}
                          </span>
                          <Etiqueta ajuste={a} />
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          De {formatCurrency(a.saldoSistema)} para {formatCurrency(a.saldoReal)}
                        </p>
                        <p className="text-slate-600 mt-1">{a.motivo}</p>

                        <p className="text-slate-400 mt-1">
                          Feito por {a.criador?.nome || 'usuário removido'} em {formatDateTime(a.criadoEm)}
                        </p>

                        {a.editadoEm && (
                          <p className="text-slate-400">
                            Editado por {a.editor?.nome || 'usuário removido'} em {formatDateTime(a.editadoEm)}
                            {Array.isArray(a.revisoes) && a.revisoes.length > 0 && (
                              <button
                                onClick={() => setVerRevisoes(verRevisoes === a.id ? null : a.id)}
                                className="ml-2 underline hover:text-navy-700"
                              >
                                {verRevisoes === a.id
                                  ? 'ocultar versões anteriores'
                                  : `ver ${a.revisoes.length} versão(ões) anterior(es)`}
                              </button>
                            )}
                          </p>
                        )}

                        {a.canceladoEm && (
                          <p className="text-slate-500 mt-1">
                            Cancelado por {a.cancelador?.nome || 'usuário removido'} em{' '}
                            {formatDateTime(a.canceladoEm)} — {a.motivoCancelamento}
                          </p>
                        )}
                      </div>

                      {/* Ações. Quem decide quais existem é o backend. */}
                      {!emAcao && (
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {a.acoes?.editar && (
                            <button
                              onClick={() => setAberto({
                                id: a.id, modo: 'editar',
                                data:      isoDe(a.dataAjuste),
                                saldoReal: String(Number(a.saldoReal)),
                                motivo:    a.motivo,
                              })}
                              className="flex items-center gap-1 text-slate-400 hover:text-navy-700"
                              title="Corrigir data, valor ou motivo"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                          )}
                          {a.acoes?.cancelar && (
                            <button
                              onClick={() => setAberto({ id: a.id, modo: 'cancelar', motivo: '' })}
                              className="flex items-center gap-1 text-slate-400 hover:text-red-600"
                              title="Cancelar este ajuste"
                            >
                              <Trash2 size={12} /> Cancelar
                            </button>
                          )}
                          {a.acoes?.estornar && (
                            <button
                              onClick={() => setAberto({ id: a.id, modo: 'estornar', motivo: '' })}
                              className="flex items-center gap-1 text-slate-400 hover:text-red-600"
                              title="Estornar — a competência deste mês está fechada"
                            >
                              <RotateCcw size={12} /> Estornar
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Versões anteriores */}
                    {verRevisoes === a.id && Array.isArray(a.revisoes) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {a.revisoes.map((r, i) => (
                          <p key={i} className="text-slate-400">
                            Antes: {formatDate(r.dataAjuste)} · {formatCurrency(r.diferenca)} ·
                            {' '}de {formatCurrency(r.saldoSistema)} para {formatCurrency(r.saldoReal)} ·
                            {' '}“{r.motivo}” — alterado por {r.substituidoPor?.nome || '—'} em{' '}
                            {formatDateTime(r.substituidoEm)}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* ── Editar ──────────────────────────────────── */}
                    {editando && (() => {
                      const saldoEd = previaEd?.saldoSistema;
                      const infoEd  = num(aberto.saldoReal);
                      const difEd   = calcularDiferenca(saldoEd, infoEd);
                      const okEd    = difEd !== null && difEd !== 0
                                      && aberto.motivo.trim().length >= MOTIVO_MIN && !salvando;

                      return (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-slate-600">
                            Mudar a data recalcula tudo: o saldo do sistema naquele outro dia é
                            outro, e a diferença muda junto. O lançamento continua sendo o mesmo,
                            só passa a valer com os novos valores.
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="input-label">Data do ajuste</label>
                              <input type="date" className="input-field text-xs" value={aberto.data}
                                     onChange={(e) => setAberto({ ...aberto, data: e.target.value })} />
                            </div>
                            <div>
                              <label className="input-label">Saldo do sistema sem este ajuste</label>
                              <div className="input-field bg-slate-50 flex items-center text-xs text-slate-700">
                                {saldoEd === undefined ? 'Calculando...' : formatCurrency(saldoEd)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="input-label">Saldo real do extrato</label>
                            <input type="number" step="0.01" className="input-field text-xs"
                                   value={aberto.saldoReal}
                                   onChange={(e) => setAberto({ ...aberto, saldoReal: e.target.value })} />
                          </div>

                          <ResumoDiferenca diferenca={difEd} saldoSistema={saldoEd} informado={infoEd} />

                          <div>
                            <label className="input-label">Motivo</label>
                            <textarea className="input-field text-xs min-h-[50px]" rows={2}
                                      value={aberto.motivo}
                                      onChange={(e) => setAberto({ ...aberto, motivo: e.target.value })} />
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => setAberto(null)} disabled={salvando}
                                    className="btn-secondary flex-1 text-xs py-1.5">
                              Voltar
                            </button>
                            <button onClick={() => salvarEdicao(a)} disabled={!okEd}
                                    className="btn-primary flex-1 text-xs py-1.5 disabled:opacity-50">
                              {salvando ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Cancelar ────────────────────────────────── */}
                    {aberto?.id === a.id && aberto.modo === 'cancelar' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-slate-600">
                          O lançamento de {formatCurrency(Math.abs(dif))} é apagado e o saldo da conta
                          volta ao que era antes deste ajuste. Esta linha continua aqui, marcada como
                          cancelada, com seu nome e o motivo.
                        </p>
                        <p className="text-amber-700">
                          Atenção: o marco de corte de {formatDate(a.dataAjuste)} deixa de valer. Se
                          alguma importação de OFX já descartou lançamentos por serem anteriores a
                          essa data, eles não voltam sozinhos — é preciso importar o extrato de novo.
                        </p>
                        <textarea className="input-field text-xs min-h-[50px]" rows={2}
                                  placeholder="Motivo do cancelamento"
                                  value={aberto.motivo}
                                  onChange={(e) => setAberto({ ...aberto, motivo: e.target.value })} />
                        <div className="flex gap-2">
                          <button onClick={() => setAberto(null)} disabled={salvando}
                                  className="btn-secondary flex-1 text-xs py-1.5">
                            Voltar
                          </button>
                          <button onClick={() => confirmarCancelamento(a)}
                                  disabled={aberto.motivo.trim().length < MOTIVO_MIN || salvando}
                                  className="btn-danger flex-1 text-xs py-1.5 disabled:opacity-50">
                            {salvando ? 'Cancelando...' : 'Confirmar cancelamento'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Estornar ────────────────────────────────── */}
                    {aberto?.id === a.id && aberto.modo === 'estornar' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-slate-600">
                          A competência de {formatDate(a.dataAjuste)} está fechada, então este ajuste
                          não pode ser alterado nem cancelado. O estorno cria um lançamento contrário
                          com a data de hoje; o ajuste original continua no histórico.
                        </p>
                        <textarea className="input-field text-xs min-h-[50px]" rows={2}
                                  placeholder="Motivo do estorno"
                                  value={aberto.motivo}
                                  onChange={(e) => setAberto({ ...aberto, motivo: e.target.value })} />
                        <div className="flex gap-2">
                          <button onClick={() => setAberto(null)} disabled={salvando}
                                  className="btn-secondary flex-1 text-xs py-1.5">
                            Voltar
                          </button>
                          <button onClick={() => confirmarEstorno(a)}
                                  disabled={aberto.motivo.trim().length < MOTIVO_MIN || salvando}
                                  className="btn-danger flex-1 text-xs py-1.5 disabled:opacity-50">
                            {salvando ? 'Estornando...' : 'Confirmar estorno'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Ajuste novo ───────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          {!criando ? (
            <button onClick={() => setCriando(true)}
                    className="flex items-center gap-2 text-sm text-navy-700 hover:text-navy-900 font-medium">
              <Plus size={15} /> Fazer um novo ajuste
            </button>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-navy-800">Novo ajuste</h4>

              {previa?.ultimoAjuste && (
                <p className="text-xs text-slate-500">
                  Esta conta já teve um ajuste em {formatDate(previa.ultimoAjuste)}. Se a intenção é
                  corrigir aquele, use <strong>Editar</strong> ali em cima, em vez de criar outro.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Data do ajuste *</label>
                  <input type="date" className="input-field" value={data}
                         onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Saldo do sistema nesta data</label>
                  <div className="input-field bg-slate-50 flex items-center text-slate-700">
                    {carregando ? 'Calculando...'
                      : saldoSistema === undefined ? '—'
                        : formatCurrency(saldoSistema)}
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label">Saldo real do extrato bancário *</label>
                <input type="number" step="0.01" className="input-field" placeholder="0,00"
                       value={saldoReal} onChange={(e) => setSaldoReal(e.target.value)} />
              </div>

              <ResumoDiferenca diferenca={diferenca} saldoSistema={saldoSistema} informado={informado} />

              {/* A categoria é fixa e escolhida pelo sentido. Aparece só para o
                  contador conferir como o lançamento é rotulado dentro do Finance.
                  Ela não tem conta contábil: o ajuste não vai para o Domínio. */}
              {categoria && (
                <div className="border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Categoria</p>
                  <p className="text-sm font-medium text-navy-800">{categoria.nome}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Serve só para identificar o lançamento aqui no Finance. O ajuste não
                    tem conta de débito e crédito porque não vai para a contabilidade.
                  </p>
                </div>
              )}

              <div>
                <label className="input-label">Motivo do ajuste *</label>
                <textarea
                  className="input-field min-h-[70px]" rows={3}
                  placeholder="Ex: Cliente parou de lançar a partir de agosto. Saldo acertado pelo extrato do Bradesco."
                  value={motivo} onChange={(e) => setMotivo(e.target.value)}
                />
                <p className={`text-[10px] mt-1 ${motivoOk ? 'text-slate-400' : 'text-amber-600'}`}>
                  {motivoOk
                    ? 'Esta justificativa fica registrada no histórico.'
                    : `Explique com pelo menos ${MOTIVO_MIN} caracteres. Faltam ${Math.max(0, MOTIVO_MIN - motivo.trim().length)}.`}
                </p>
              </div>

              <div className="flex gap-3">
                {ativos.length > 0 && (
                  <button onClick={() => setCriando(false)} disabled={salvando}
                          className="btn-secondary flex-1">
                    Voltar
                  </button>
                )}
                <button onClick={salvar} disabled={!podeSalvar}
                        className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {salvando ? 'Ajustando...'
                    : diferenca && diferenca !== 0
                      ? `Ajustar em ${formatCurrency(Math.abs(diferenca))}`
                      : 'Ajustar saldo'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-1">
          <button onClick={onClose} disabled={salvando} className="btn-secondary w-full">
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
