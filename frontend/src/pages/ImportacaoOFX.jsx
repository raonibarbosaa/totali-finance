import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp, Upload, Trash2, ChevronRight, Calendar, FileText,
  CheckCircle2, Clock, AlertTriangle, Loader2, Building2
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { useBankAccounts } from '../hooks/useFinanceData';
import useRole from '../hooks/useRole';
import { formatDate } from '../utils/formatters';

function dateOnlyBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function dateTimeBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ImportacaoOFX() {
  const navigate = useNavigate();
  const { contas } = useBankAccounts();
  const { hasRole } = useRole();
  const fileInputRef = useRef(null);

  const [imports, setImports]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [bankAccountId, setBankAccountId] = useState('');
  const [file, setFile]                 = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [confirmDel, setConfirmDel]     = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ofx/imports?limit=50');
      setImports(data.data?.data || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setErrorMsg('');
    if (!f) {
      setFile(null);
      return;
    }
    if (!/\.ofx$/i.test(f.name)) {
      setErrorMsg('O arquivo deve ter extensão .OFX');
      setFile(null);
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrorMsg('Arquivo OFX excede 5 MB.');
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    setErrorMsg('');
    if (!bankAccountId) {
      setErrorMsg('Selecione a conta bancária.');
      return;
    }
    if (!file) {
      setErrorMsg('Selecione um arquivo OFX.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bankAccountId', bankAccountId);
      const { data } = await api.post('/ofx/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Limpa form e navega pra conciliação do import recém-criado
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      navigate(`/app/conciliacao?importId=${data.data.importId}`);
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.code === 'DUPLICATE_FILE' && resp?.data?.existingImportId) {
        const id = resp.data.existingImportId;
        // eslint-disable-next-line no-alert
        if (window.confirm(`${resp.error}\n\nDeseja abrir a importação original?`)) {
          navigate(`/app/conciliacao?importId=${id}`);
        } else {
          setErrorMsg(resp.error);
        }
      } else {
        setErrorMsg(resp?.error || 'Falha ao importar arquivo OFX.');
      }
    }
    setUploading(false);
  }

  async function excluirImport() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await api.delete(`/ofx/imports/${confirmDel.id}`);
      setConfirmDel(null);
      carregar();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.response?.data?.error || 'Erro ao excluir importação.');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-lg">Importação OFX</h2>
        <p className="text-sm text-slate-400">
          Importe extratos bancários em formato OFX. O sistema concilia automaticamente
          as transações que batem (data, valor e conta) com lançamentos existentes.
        </p>
      </div>

      {/* Form de upload */}
      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="input-label">Conta bancária</label>
            <select
              className="input-field text-sm"
              value={bankAccountId}
              onChange={(e) => { setBankAccountId(e.target.value); setErrorMsg(''); }}
              disabled={uploading}
            >
              <option value="">Selecione...</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.banco ? ` (${c.banco})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="input-label">Arquivo OFX</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-slate-600
                         file:mr-3 file:py-2 file:px-3 file:rounded-lg
                         file:border file:border-slate-200 file:text-xs
                         file:font-medium file:bg-slate-50
                         hover:file:bg-slate-100 file:cursor-pointer
                         disabled:opacity-50"
            />
            {file && (
              <p className="text-[11px] text-slate-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 items-start">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !bankAccountId}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Importando...</>
            ) : (
              <><Upload size={14} /> Importar OFX</>
            )}
          </button>
        </div>
      </div>

      {/* Lista de imports anteriores */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-navy-800 text-sm">
            Importações anteriores
          </h3>
          <p className="text-xs text-slate-400">
            {imports.length} importaç{imports.length === 1 ? 'ão' : 'ões'}
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
              icon={FileUp}
              title="Nenhuma importação ainda"
              description="Importe seu primeiro extrato OFX usando o formulário acima."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {imports.map((imp) => (
              <div
                key={imp.id}
                className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-navy-700" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-navy-800 text-sm truncate">
                        {imp.nomeArquivo || 'Arquivo OFX'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Building2 size={11} />
                      <span>{imp.bankAccount?.nome || '—'}</span>
                      <span className="text-slate-300">·</span>
                      <Calendar size={11} />
                      <span>
                        {dateOnlyBR(imp.dataInicio)} a {dateOnlyBR(imp.dataFim)}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Importado em {dateTimeBR(imp.importadoEm)}
                      {imp.importador?.nome && ` por ${imp.importador.nome}`}
                    </p>

                    <div className="flex gap-2 mt-2 text-[11px] flex-wrap">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        {imp.conciliados || 0} conciliad{(imp.conciliados || 0) === 1 ? 'a' : 'as'}
                      </span>
                      {(imp.pendentes || 0) > 0 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
                          <Clock size={11} />
                          {imp.pendentes} pendente{imp.pendentes === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded">
                        {imp.totalRegistros || 0} registros
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 items-end">
                    <button
                      onClick={() => navigate(`/app/conciliacao?importId=${imp.id}`)}
                      className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"
                    >
                      Conciliar <ChevronRight size={12} />
                    </button>
                    {hasRole(1) && (
                      <button
                        onClick={() => setConfirmDel(imp)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50
                                   rounded p-1.5 transition-colors"
                        title="Excluir importação"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar exclusão */}
      <Modal
        open={!!confirmDel}
        onClose={() => !deleting && setConfirmDel(null)}
        title="Excluir importação OFX"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Excluir a importação <strong>{confirmDel?.nomeArquivo || 'sem nome'}</strong>?
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle size={12} /> Esta ação:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Apaga todas as linhas do extrato vinculadas a esta importação</li>
              <li>Desfaz a conciliação dos lançamentos existentes que foram batidos automaticamente</li>
              <li>Apaga lançamentos criados via "Criar lançamento" a partir desta importação (exceto os já exportados pra Domínio)</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDel(null)}
              disabled={deleting}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={excluirImport}
              disabled={deleting}
              className="btn-danger flex-1 flex items-center justify-center gap-2"
            >
              {deleting ? <><Loader2 size={14} className="animate-spin" /> Excluindo...</> : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
