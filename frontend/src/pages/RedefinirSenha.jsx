import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import AuthShell from '../components/auth/AuthShell';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [validando, setValidando] = useState(true);
  const [tokenInvalido, setTokenInvalido] = useState('');
  const [dados, setDados] = useState(null);

  const [form, setForm] = useState({ senha: '', confirmacao: '' });
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);

  // Valida o link antes de mostrar o formulário
  useEffect(() => {
    if (!token) {
      setTokenInvalido('Link inválido. Solicite uma nova redefinição.');
      setValidando(false);
      return;
    }

    let ativo = true;
    api
      .get(`/auth/redefinir-senha/${token}`)
      .then(({ data }) => {
        if (ativo) setDados(data.data);
      })
      .catch((err) => {
        if (ativo) {
          setTokenInvalido(
            err.response?.data?.error || 'Link inválido ou expirado. Solicite uma nova redefinição.'
          );
        }
      })
      .finally(() => {
        if (ativo) setValidando(false);
      });

    return () => {
      ativo = false;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (form.senha !== form.confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/redefinir-senha', {
        token,
        senha: form.senha,
        confirmacao: form.confirmacao,
      });
      setConcluido(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (validando) {
    return (
      <AuthShell titulo="Redefinir senha" subtitulo="Validando seu link..." voltarPara={null}>
        <div className="flex justify-center py-6">
          <span className="w-6 h-6 border-2 border-navy-200 border-t-navy-800 rounded-full animate-spin" />
        </div>
      </AuthShell>
    );
  }

  if (tokenInvalido) {
    return (
      <AuthShell titulo="Link expirado" subtitulo="Não foi possível validar este link">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-4 rounded-lg flex gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>{tokenInvalido}</p>
        </div>
        <Link
          to="/esqueci-senha"
          className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-4"
        >
          Solicitar novo link
        </Link>
      </AuthShell>
    );
  }

  if (concluido) {
    return (
      <AuthShell titulo="Senha alterada" subtitulo="Tudo certo por aqui">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-4 rounded-lg flex gap-3">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Senha redefinida com sucesso.</p>
            <p className="mt-1">Redirecionando para o login...</p>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar nova senha"
      subtitulo={dados?.email ? `Conta: ${dados.email}` : 'Escolha uma nova senha de acesso'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">Nova senha</label>
          <div className="relative">
            <input
              type={showSenha ? 'text' : 'password'}
              className="input-field pr-10"
              placeholder="••••••••"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              autoComplete="new-password"
              autoFocus
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowSenha(!showSenha)}
            >
              {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Mínimo de 8 caracteres, com letras e números.</p>
        </div>

        <div>
          <label className="input-label">Confirme a nova senha</label>
          <input
            type={showSenha ? 'text' : 'password'}
            className="input-field"
            placeholder="••••••••"
            value={form.confirmacao}
            onChange={(e) => setForm({ ...form, confirmacao: e.target.value })}
            autoComplete="new-password"
            required
          />
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
            <KeyRound size={16} />
          )}
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthShell>
  );
}
