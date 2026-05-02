import { useState, useEffect } from 'react';
import api from '../services/api';

const MONTHS = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function FechamentoCompetencia() {
  const now  = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [periods, setPeriods]   = useState([]);
  const [status, setStatus]     = useState(null);
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');

  const loadPeriods = () => api.get('/periods').then(r => setPeriods(r.data.data || []));
  const loadStatus  = () => api.get('/periods/status', { params: { year, month } })
    .then(r => setStatus(r.data.data));

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => { loadStatus(); setMessage(''); }, [year, month]);

  const handleClose = async () => {
    if (!confirm(`Fechar a competência ${MONTHS[month]}/${year}? Lançamentos retroativos serão bloqueados.`)) return;
    setLoading(true);
    try {
      await api.post('/periods/close', { year, month, notes });
      setMessage('✅ Período fechado com sucesso.');
      setNotes('');
      loadPeriods();
      loadStatus();
    } catch (e) { setMessage('❌ ' + (e.response?.data?.error || 'Erro ao fechar período')); }
    finally { setLoading(false); }
  };

  const handleReopen = async () => {
    if (!confirm(`Reabrir a competência ${MONTHS[month]}/${year}?`)) return;
    setLoading(true);
    try {
      await api.post('/periods/reopen', { year, month });
      setMessage('✅ Período reaberto.');
      loadPeriods();
      loadStatus();
    } catch (e) { setMessage('❌ ' + (e.response?.data?.error || 'Erro ao reabrir período')); }
    finally { setLoading(false); }
  };

  const isClosed = status?.closed;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#152740]">Fechamento de Competência</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bloqueie lançamentos retroativos ao fechar o período mensal</p>
      </div>

      {/* Seletor de período + ação */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-[#152740] mb-4">Selecionar Competência</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20">
              {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>

          {/* Status do período selecionado */}
          {status !== null && (
            <div className={`px-5 py-3 rounded-xl text-sm font-medium ${isClosed ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {isClosed ? '🔒 Período FECHADO' : '🔓 Período ABERTO'}
            </div>
          )}
        </div>

        {!isClosed && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Conferência concluída, lançamentos revisados"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
            </div>
            <button onClick={handleClose} disabled={loading}
              className="px-6 py-2.5 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50">
              {loading ? 'Fechando...' : `🔒 Fechar ${MONTHS[month]}/${year}`}
            </button>
          </div>
        )}

        {isClosed && (
          <div className="mt-4 space-y-3">
            <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm">
              <p className="font-medium text-red-700 mb-1">Período bloqueado</p>
              <p className="text-red-500">Fechado em: {status.record?.closed_at ? new Date(status.record.closed_at).toLocaleString('pt-BR') : '—'}</p>
              {status.record?.notes && <p className="text-red-500 mt-1">Obs: {status.record.notes}</p>}
            </div>
            <button onClick={handleReopen} disabled={loading}
              className="px-6 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 disabled:opacity-50">
              {loading ? 'Reabrindo...' : `🔓 Reabrir ${MONTHS[month]}/${year}`}
            </button>
          </div>
        )}

        {message && (
          <div className={`mt-4 px-4 py-2 rounded-xl text-sm ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Lista de todos os períodos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#152740]">Histórico de Competências</h2>
        </div>
        {periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p>Nenhum período registrado ainda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Competência</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Fechado em</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Por</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-[#152740]">
                    {MONTHS[p.month]} / {p.year}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${p.closed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {p.closed ? '🔒 Fechado' : '🔓 Aberto'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {p.closed_at ? new Date(p.closed_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{p.closer?.name || '—'}</td>
                  <td className="px-3 py-3 text-gray-400">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
