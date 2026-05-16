import { useState, useEffect, useCallback } from 'react';
import {
  Cloud, RefreshCw, Settings, ExternalLink, CheckCircle2, AlertCircle,
  Download, FileText, Clock, X, FolderOpen
} from 'lucide-react';
import api from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDateTime(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function extractFolderId(input) {
  if (!input) return null;
  const m = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return null;
}

const STATUS_LABEL = {
  success:          { text: 'Importado',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  already_imported: { text: 'Já importado',  cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  error:            { text: 'Erro',          cls: 'bg-red-50 text-red-700 border-red-100' },
};

// ─── Componente ──────────────────────────────────────────────────────────────
export default function IntegracaoDrive() {
  const [config, setConfig]     = useState(null);
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [modal, setModal]       = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [error, setError]       = useState('');

  // ── Fetch dados ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, logsRes] = await Promise.all([
        api.get('/drive/config'),
        api.get('/drive/logs'),
      ]);
      setConfig(cfgRes.data?.data ?? null);
      setLogs(logsRes.data?.data ?? []);
    } catch (e) {
      console.error('Erro ao carregar dados do Drive:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Sincronizar agora ────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    try {
      await api.post('/drive/sync');
      await fetchData();
    } catch (e) {
      alert('Erro ao sincronizar: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSyncing(false);
    }
  }

  // ── Salvar configuração ──────────────────────────────────────────────────
  function openConfigModal() {
    setFolderInput(config?.folderUrl || '');
    setError('');
    setModal(true);
  }

  async function handleSaveConfig() {
    const folderId = extractFolderId(folderInput);
    if (!folderId) {
      setError('URL ou ID da pasta inválido.');
      return;
    }
    try {
      await api.post('/drive/config', {
        folderId,
        folderUrl: folderInput.startsWith('http') ? folderInput : `https://drive.google.com/drive/folders/${folderId}`,
        source: 'totali',
      });
      setModal(false);
      await fetchData();
    } catch (e) {
      setError(e?.response?.data?.error || 'Erro ao salvar configuração.');
    }
  }

  // ── Baixar OFX original ──────────────────────────────────────────────────
  async function handleDownload(log) {
    try {
      const res = await api.get(`/drive/logs/${log.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = log.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao baixar arquivo: ' + (e?.response?.data?.error || e.message));
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#152740]">Integração Google Drive</h1>
        <p className="text-sm text-gray-500 mt-1">Importação automática de extratos OFX a cada 15 minutos</p>
      </div>

      {/* Status da conexão */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config?.active ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <Cloud className={config?.active ? 'text-emerald-600' : 'text-gray-400'} size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#152740]">Status da Conexão</h2>
                {config?.active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 size={12} /> Conectada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    <AlertCircle size={12} /> Não configurada
                  </span>
                )}
              </div>

              {config?.active ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-gray-600">
                    Pasta:{' '}
                    {config.folderUrl ? (
                      <a href={config.folderUrl} target="_blank" rel="noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        Abrir no Drive <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="font-mono text-xs">{config.folderId}</span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock size={11} /> Última verificação: {formatDateTime(config.lastCheckedAt)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Configure a pasta do Google Drive para começar a importar OFX automaticamente.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {config?.active && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#152740] text-white rounded-xl hover:bg-[#1e3a5f] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>
            )}
            <button
              onClick={openConfigModal}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[#152740] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Settings size={14} />
              {config?.active ? 'Reconfigurar' : 'Configurar'}
            </button>
          </div>
        </div>
      </div>

      {/* Como funciona */}
      {!config?.active && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            💡 Como funciona
          </h3>
          <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
            <li>A Totali cria uma pasta exclusiva para sua empresa no Google Drive</li>
            <li>Você recebe o link da pasta e ela fica compartilhada com seu acesso</li>
            <li>Sempre que tiver um novo extrato, basta arrastar o OFX para dentro da pasta</li>
            <li>O sistema importa automaticamente em até 15 minutos e te notifica</li>
            <li>O arquivo original fica salvo aqui no painel para você ou a contabilidade baixarem quando quiserem</li>
          </ol>
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#152740]">Histórico de Importações</h2>
          <span className="text-xs text-gray-400">{logs.length} {logs.length === 1 ? 'registro' : 'registros'}</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FolderOpen className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 text-sm">Nenhuma importação registrada ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Os arquivos que você jogar no Drive aparecerão aqui.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Data</th>
                <th className="px-6 py-3 text-left">Arquivo</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Lançamentos</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => {
                const badge = STATUS_LABEL[log.status] || { text: log.status, cls: 'bg-gray-50 text-gray-600 border-gray-100' };
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{formatDateTime(log.importedAt)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-md">{log.fileName}</span>
                      </div>
                      {log.errorMsg && (
                        <p className="text-xs text-red-500 mt-1 ml-6">{log.errorMsg}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-[#152740]">
                      {log.transactionCount > 0 ? log.transactionCount : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.driveFileId && (
                        <button
                          onClick={() => handleDownload(log)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-100 hover:border-blue-300 rounded-lg transition-colors"
                          title="Baixar OFX original"
                        >
                          <Download size={12} /> Baixar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal configurar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-[#152740]">Configurar Pasta do Drive</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL ou ID da pasta *</label>
                <input
                  type="text"
                  value={folderInput}
                  onChange={e => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#152740]/20"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Cole a URL completa da pasta ou apenas o ID (parte depois de <code className="bg-gray-100 px-1 rounded">/folders/</code>)
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
                <strong>Importante:</strong> a pasta precisa estar compartilhada com{' '}
                <code className="bg-amber-100 px-1 rounded text-[11px]">totalifinance-drive@finance-496518.iam.gserviceaccount.com</code>{' '}
                como Editor.
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(false)} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button
                onClick={handleSaveConfig}
                className="px-6 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] transition-colors"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
