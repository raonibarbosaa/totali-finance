import { useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import AuthShell from '../components/auth/AuthShell';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      await api.post('/auth/esqueci-senha', { email: email.trim() });
      setEnviado(true);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <AuthShell
        titulo="Verifique seu e-mail"
        subtitulo="Enviamos as instruções de redefinição"
      >
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-4 rounded-lg flex gap-3">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Pedido registrado.</p>
            <p className="mt-1">
              Se <strong>{email.trim()}</strong> estiver cadastrado, o link para criar uma nova
              senha chega em instantes. Ele vale por 60 minutos e só pode ser usado uma vez.
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Não recebeu? Confira a caixa de spam ou fale com o escritório.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Esqueci minha senha"
      subtitulo="Informe seu e-mail para receber o link de redefinição"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">E-mail</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              className="input-field pl-9"
              placeholder="seu@email.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {loading ? 'Enviando...' : 'Enviar link de redefinição'}
        </button>
      </form>
    </AuthShell>
  );
}
