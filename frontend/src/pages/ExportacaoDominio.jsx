import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt     = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export default function ExportacaoDominio() {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const lastDay  = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);

  const [params, setParams] = useState({ dateFrom: firstDay, dateTo: lastDay });
  const [preview, setPreview]     = useState([]);
  const [exportLogs, setExportLogs] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(new Set());

  const loadLogs = () => api.get('/export').then(r => setExportLogs(r.data.data || []));

  useEffect(() => { loadLogs(); }, []);

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    try {
      const res = await api.get('/export/preview', { params });
      setPreview(res.data.data || []);
    } catch (e) { setError(e.response?.data?.error || 'Erro ao carregar preview'); }
    finally { setLoading(false); }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    const readyIds = preview.filter(p => p.ready).map(p => p.id);
    setSelected(prev => prev.size === readyIds.length ? new Set() : new Set(readyIds));
  };

  const handleGenerate = async () => {
    const ids = selected.size > 0 ? [...selected] : null;
    if (!ids && preview.filter(p => p.ready).length === 0) {
      setError('Nenhum lançamento pronto para exportação (todos precisam de Conta Débito e Conta Crédito)');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/export/generate', {
        dateFrom: params.dateFrom,
        dateTo:   params.dateTo,
        transactionIds: ids,
      });
      const { content, filename } = res.data.data;
      // Download automático
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      loadLogs();
      setPreview([]);
    } catch (e) { setError(e.response?.data?.error || 'Erro ao gerar exportação'); }
    finally { setGenerating(false); }
  };

  const downloadLog = async (id) => {
    const res = await api.get(`/export/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `dominio_${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readyCount   = preview.filter(p => p.ready).length;
  const notReadyCount = preview.filter(p => !p.ready).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#152740]">Exportação Domínio Contábil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gera o arquivo TXT no layout de importação do Domínio</p>
      </div>

      {/* Seleção de período */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-[#152740] mb-4">Selecionar Período</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input type="date" value={params.dateFrom}
              onChange={e => setParams(p => ({...p, dateFrom: e.target.value}))}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input type="date" value={params.dateTo}
              onChange={e => setParams(p => ({...p, dateTo: e.target.value}))}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20" />
          </div>
          <button onClick={loadPreview} disabled={loading}
            className="px-6 py-2.5 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50">
            {loading ? 'Carregando...' : '🔍 Visualizar Lançamentos'}
          </button>
        </div>
        {error && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2">{error}</div>}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-[#152740]">
                {preview.length} lançamento(s) no período
              </h2>
              <div className="flex gap-2">
                <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  ✅ {readyCount} prontos
                </span>
                {notReadyCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                    ⚠️ {notReadyCount} sem codificação
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || readyCount === 0}
              className="px-6 py-2 bg-[#C9A254] text-white text-sm font-bold rounded-xl hover:bg-[#b8913d] disabled:opacity-50 transition-colors"
            >
              {generating ? 'Gerando...' : `⬇️ Exportar ${selected.size > 0 ? selected.size : readyCount} lançamentos`}
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-center">
                  <input type="checkbox"
                    checked={selected.size === readyCount && readyCount > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[#152740]" />
                </th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Data</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Descrição</th>
                <th className="text-right px-3 py-3 text-gray-500 font-medium">Valor</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Cto D</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Cto C</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Hist</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(txn => (
                <tr key={txn.id}
                  onClick={() => txn.ready && toggleSelect(txn.id)}
                  className={`border-b border-gray-50 transition-colors cursor-pointer ${
                    selected.has(txn.id) ? 'bg-[#152740]/5' : txn.ready ? 'hover:bg-gray-50' : 'opacity-50'
                  }`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={selected.has(txn.id)} readOnly
                      disabled={!txn.ready}
                      className="w-4 h-4 accent-[#152740]" />
                  </td>
                  <td className="px-3 py-3 text-gray-600">{fmtDate(txn.date)}</td>
                  <td className="px-3 py-3 text-[#152740] font-medium max-w-xs truncate">{txn.description}</td>
                  <td className="px-3 py-3 text-right font-medium">{fmt(txn.amount)}</td>
                  <td className="px-3 py-3 text-center font-mono text-sm">{txn.conta_debito || <span className="text-red-400">—</span>}</td>
                  <td className="px-3 py-3 text-center font-mono text-sm">{txn.conta_credito || <span className="text-red-400">—</span>}</td>
                  <td className="px-3 py-3 text-center text-gray-500">{txn.historico || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    {txn.exported
                      ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Já exportado</span>
                      : txn.ready
                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Pronto</span>
                        : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Sem codificação</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Preview do TXT */}
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2">Prévia do arquivo TXT (primeiras linhas):</p>
            <pre className="text-xs text-gray-600 font-mono bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">
              Data;CtoD;CtoC;Valor;Hist;Complemento;Filial;CCD;CCC{'\n'}
              {preview.filter(p => p.ready).slice(0, 5).map(txn => {
                const d = new Date(txn.date);
                const date = `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
                const val  = Number(txn.amount).toFixed(2).replace('.',',');
                return `${date};${txn.conta_debito||''};${txn.conta_credito||''};${val};${txn.historico||''};${txn.description};${txn.filial};${txn.centro_custo_d||''};${txn.centro_custo_c||''}`;
              }).join('\n')}
              {preview.filter(p => p.ready).length > 5 ? '\n...' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* Histórico de exportações */}
      {exportLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-[#152740]">Histórico de Exportações</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Data Exportação</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Período</th>
                <th className="text-left px-3 py-3 text-gray-500 font-medium">Exportado por</th>
                <th className="text-center px-3 py-3 text-gray-500 font-medium">Registros</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Download</th>
              </tr>
            </thead>
            <tbody>
              {exportLogs.map(log => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-gray-600">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-3 text-[#152740]">{fmtDate(log.date_from)} → {fmtDate(log.date_to)}</td>
                  <td className="px-3 py-3 text-gray-500">{log.exporter?.name || '—'}</td>
                  <td className="px-3 py-3 text-center font-medium text-[#152740]">{log.total_records}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => downloadLog(log.id)}
                      className="px-3 py-1.5 bg-[#152740] text-white text-xs rounded-lg hover:bg-[#1e3a5f] transition-colors">
                      ⬇️ Baixar TXT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
