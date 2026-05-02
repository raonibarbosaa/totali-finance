import { useState, useEffect } from 'react';
import { Settings, Check, Building2, FileText, BookOpen } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function ConfiguracaoEmpresa() {
  const { tenant } = useAuthStore();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ codigoFilial: '', regime: 'caixa' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/company-settings');
        setConfig(data.data);
        setForm({
          codigoFilial: data.data.codigoFilial || '',
          regime: data.data.regime || 'caixa',
        });
      } catch (_) {}
      setLoading(false);
    }
    load();
  }, [tenant?.id]);

  async function salvar() {
    setErro('');
    setSaving(true);
    try {
      const { data } = await api.put('/company-settings', form);
      setConfig(data.data);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="card p-6 animate-pulse space-y-3">
            <div className="h-4 bg-slate-100 rounded w-32" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-lg">
          Configuração da Empresa
        </h2>
        <p className="text-sm text-slate-400">
          {config?.razaoSocial}
        </p>
      </div>

      {/* Card Regime Contábil */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <BookOpen size={16} className="text-purple-700" />
          </div>
          <div>
            <p className="font-display font-semibold text-navy-800 text-sm">
              Regime Contábil
            </p>
            <p className="text-xs text-slate-400">
              Define como a DRE e o DFC apresentam os dados
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            {
              value: 'caixa',
              label: 'Regime de Caixa',
              desc: 'Considera a data do pagamento/recebimento efetivo.',
            },
            {
              value: 'competencia',
              label: 'Regime de Competência',
              desc: 'Considera a data de vencimento ou competência do lançamento.',
            },
          ].map(r => (
            <label
              key={r.value}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.regime === r.value
                  ? 'border-navy-600 bg-navy-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                value={r.value}
                checked={form.regime === r.value}
                onChange={() => setForm({ ...form, regime: r.value })}
              />
              <div className="flex items-start gap-2.5">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5
                  flex items-center justify-center transition-colors ${
                    form.regime === r.value
                      ? 'border-navy-600 bg-navy-600'
                      : 'border-slate-300'
                  }`}>
                  {form.regime === r.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    form.regime === r.value ? 'text-navy-800' : 'text-slate-700'
                  }`}>
                    {r.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Card Domínio Contábil */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-gold-100 rounded-xl flex items-center justify-center">
            <FileText size={16} className="text-gold-700" />
          </div>
          <div>
            <p className="font-display font-semibold text-navy-800 text-sm">
              Exportação Domínio Contábil
            </p>
            <p className="text-xs text-slate-400">
              Identificação desta empresa no sistema Domínio
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="input-label">Código da Filial *</label>
          <input
            className="input-field font-mono"
            placeholder="Ex: 1"
            value={form.codigoFilial}
            onChange={e => setForm({ ...form, codigoFilial: e.target.value })}
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Código usado no campo 7 de cada linha do arquivo TXT exportado.
          </p>
        </div>

        {/* Prévia da linha */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] text-slate-400 font-medium mb-1">
            Prévia da linha exportada
          </p>
          <p className="font-mono text-[11px] text-slate-600 break-all">
            DD/MM/AAAA;CtoD;CtoC;Valor;Hist;Complemento;
            <span className="bg-gold-200 text-gold-800 px-0.5 rounded">
              {form.codigoFilial || '___'}
            </span>
            ;;
          </p>
        </div>
      </div>

      {/* Dados da empresa (só leitura) */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
            <Building2 size={16} className="text-slate-600" />
          </div>
          <div>
            <p className="font-display font-semibold text-navy-800 text-sm">
              Dados da empresa
            </p>
            <p className="text-xs text-slate-400">
              Somente o escritório pode alterar estes dados
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Razão Social', value: config?.razaoSocial },
            { label: 'CNPJ', value: config?.cnpj },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-sm text-slate-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                        px-4 py-3 rounded-lg">{erro}</div>
      )}

      {/* Botão salvar */}
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Check size={15} />}
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {salvo && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5
                           animate-fade-in">
            <Check size={14} /> Configurações salvas!
          </span>
        )}
      </div>
    </div>
  );
}
