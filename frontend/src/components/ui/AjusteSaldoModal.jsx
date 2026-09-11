// frontend/src/components/ui/AjusteSaldoModal.jsx
//
// Ajuste de saldo bancário, com histórico auditável.
//
// O fluxo é deliberadamente lento numa etapa: o usuário escolhe a data, o
// sistema mostra QUANTO ELE ACHA que a conta tem naquele dia, e só então o
// usuário digita o saldo real do extrato. A diferença aparece por extenso
// antes de confirmar, para ninguém ajustar no automático.

import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import Modal from './Modal';
import SelectComCadastro from './SelectComCadastro';
import balanceAdjustmentsService from '../../services/balanceAdjustmentsService';
import { formatCurrency, formatDate } from '../../utils/formatters';

const MOTIVO_MIN = 10;
const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function AjusteSaldoModal({ open, conta, onClose, onSaved }) {
  const [data,       setData]       = useState(hojeISO());
  const [saldoReal,  setSaldoReal]  = useState('');
  const [motivo,     setMotivo]     = useState('');
  const [categoryId, setCategoryId] = useState(null);

  const [previa,     setPrevia]     = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando,   setSalvando]   = useState(false);
  const [erro,       setErro]       = useState('');

  const [historico,  setHistorico]  = useState([]);
  const [verHistorico, setVerHistorico] = useState(false);
  const [estornando, setEstornando] = useState(null);

  // Recomeça do zero a cada abertura, para não herdar dados de outra conta.
  useEffect(() => {
    if (!open) return;
    setData(hojeISO());
    setSaldoReal('');
    setMotivo('');
    setCategoryId(null);
    setPrevia(null);
    setErro('');
    setVerHistorico(false);
    setEstornando(null);
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
      setHistorico(r.data.data || []);
    } catch (_) {
      setHistorico([]);
    }
  }, [conta?.id]);

  useEffect(() => { if (open) carregarHistorico(); }, [open, carregarHistorico]);

  if (!open || !conta) return null;

  const saldoSistema = previa?.saldoSistema;
  const informado    = saldoReal === '' ? null : Number(saldoReal);
  const diferenca =
    saldoSistema === undefined || informado === null || !Number.isFinite(informado)
      ? null
      : Number((informado - saldoSistema).toFixed(2));

  const motivoOk = motivo.trim().length >= MOTIVO_MIN;
  const podeSalvar =
    !!previa && diferenca !== null && diferenca !== 0 && motivoOk && !!categoryId && !salvando;

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await balanceAdjustmentsService.create({
        bankAccountId:  conta.id,
        dataLancamento: data,
        saldoReal:      informado,
        motivo:         motivo.trim(),
        categoryId,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao ajustar o saldo');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarEstorno(ajuste) {
    const justificativa = (estornando?.motivo || '').trim();
    if (justificativa.length < MOTIVO_MIN) return;
    setSalvando(true);
    setErro('');
    try {
      await balanceAdjustmentsService.estornar(ajuste.id, justificativa);
      setEstornando(null);
      await carregarHistorico();
      await buscarPrevia();
      onSaved?.();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao estornar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={salvando ? () => {} : onClose}
           title={`Ajustar saldo — ${conta.nome}`} size="lg">
      <div className="space-y-4">

        {/* Explicação do que o ajuste faz. Evita o uso como atalho para
            "sumir com" uma diferença sem entender a causa. */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          O ajuste cria um lançamento no valor da diferença e fica registrado com
          seu nome e o motivo. Ele entra no saldo e no extrato, mas <strong>não</strong> entra
          no DRE nem no DFC. Se você tem o extrato em OFX, prefira importar e conciliar:
          o ajuste é o último recurso.
        </div>

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

        {/* A diferença por extenso, dizendo o que vai acontecer. */}
        {diferenca !== null && (
          <div className={`rounded-xl p-4 border flex items-start gap-3 ${
            diferenca === 0 ? 'bg-slate-50 border-slate-200'
              : diferenca > 0 ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-red-50 border-red-200'
          }`}>
            {diferenca > 0 ? <TrendingUp size={18} className="text-emerald-600 mt-0.5" />
                           : diferenca < 0 ? <TrendingDown size={18} className="text-red-600 mt-0.5" />
                                           : null}
            <div className="text-sm">
              {diferenca === 0 ? (
                <span className="text-slate-600">
                  O saldo do sistema já é igual ao saldo informado. Não há o que ajustar.
                </span>
              ) : (
                <>
                  <p className={`font-semibold ${diferenca > 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    Será criada uma {diferenca > 0 ? 'entrada' : 'saída'} de {formatCurrency(Math.abs(diferenca))}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    O saldo da conta passa de {formatCurrency(saldoSistema)} para {formatCurrency(informado)}.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Categoria é obrigatória: sem conta de débito e crédito, o ajuste
            não sai na exportação para o Domínio. */}
        <div>
          <SelectComCadastro
            label="Categoria contábil *"
            endpoint="/categories"
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
            placeholder="Selecione a categoria do ajuste..."
            cadastroFields={[
              { name: 'nome',         label: 'Nome', required: true },
              { name: 'tipo',         label: 'Tipo', type: 'select', required: true,
                options: [{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }] },
              { name: 'natureza',     label: 'Natureza', type: 'select', required: true,
                options: [{ value: 'variavel', label: 'Variável' }, { value: 'fixa', label: 'Fixa' }] },
              { name: 'contaDebito',  label: 'Conta débito (Domínio)' },
              { name: 'contaCredito', label: 'Conta crédito (Domínio)' },
            ]}
          />
          <p className="text-[10px] text-slate-400 mt-1">
            A categoria precisa ter conta de débito e crédito, senão o ajuste não sai
            na exportação para o Domínio.
          </p>
        </div>

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

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {erro}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={salvando} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button onClick={salvar} disabled={!podeSalvar}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {salvando ? 'Ajustando...'
              : diferenca && diferenca !== 0
                ? `Ajustar em ${formatCurrency(Math.abs(diferenca))}`
                : 'Ajustar saldo'}
          </button>
        </div>

        {/* ── Histórico ─────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-3">
          <button onClick={() => setVerHistorico((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-navy-700">
            <History size={13} />
            Ajustes anteriores desta conta ({historico.length})
          </button>

          {verHistorico && (
            historico.length === 0 ? (
              <p className="text-xs text-slate-400 mt-3">Nenhum ajuste registrado.</p>
            ) : (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {historico.map((a) => {
                  const dif = Number(a.diferenca);
                  return (
                    <div key={a.id} className="border border-slate-100 rounded-lg p-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-navy-800">
                            {formatDate(a.dataAjuste)}
                            <span className={dif > 0 ? 'text-emerald-600 ml-2' : 'text-red-600 ml-2'}>
                              {dif > 0 ? '+' : ''}{formatCurrency(dif)}
                            </span>
                            {a.estornoDe && (
                              <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">
                                estorno
                              </span>
                            )}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            De {formatCurrency(a.saldoSistema)} para {formatCurrency(a.saldoReal)}
                          </p>
                          <p className="text-slate-600 mt-1">{a.motivo}</p>
                          <p className="text-slate-400 mt-1">
                            {a.criador?.nome || 'Usuário removido'} em {formatDate(a.criadoEm)}
                          </p>
                        </div>
                        {!a.estornoDe && (
                          <button
                            onClick={() => setEstornando({ ajuste: a, motivo: '' })}
                            className="flex items-center gap-1 text-slate-400 hover:text-red-600 flex-shrink-0"
                            title="Estornar este ajuste"
                          >
                            <RotateCcw size={12} /> Estornar
                          </button>
                        )}
                      </div>

                      {estornando?.ajuste?.id === a.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-slate-600">
                            O estorno cria um lançamento contrário com a data de hoje. O ajuste
                            original continua no histórico.
                          </p>
                          <textarea
                            className="input-field text-xs min-h-[50px]" rows={2}
                            placeholder="Motivo do estorno"
                            value={estornando.motivo}
                            onChange={(e) => setEstornando({ ...estornando, motivo: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setEstornando(null)}
                                    className="btn-secondary flex-1 text-xs py-1.5">
                              Cancelar
                            </button>
                            <button
                              onClick={() => confirmarEstorno(a)}
                              disabled={estornando.motivo.trim().length < MOTIVO_MIN || salvando}
                              className="btn-danger flex-1 text-xs py-1.5 disabled:opacity-50"
                            >
                              Confirmar estorno
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
