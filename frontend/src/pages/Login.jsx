import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setEmpresas } = useAuthStore();

  const [form, setForm] = useState({ email: '', senha: '' });
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: form.email.trim(),
        senha: form.senha,
      });

      if (data.success) {
        setUser(data.data.user);
        setEmpresas(data.data.empresas);

        // Se só tem uma empresa, vai direto para seleção
        navigate('/selecionar-empresa');
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-800 flex">
      {/* Painel esquerdo — visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        {/* Fundo geométrico */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border border-white" />
          <div className="absolute top-32 left-32 w-40 h-40 rounded-full border border-white" />
          <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full border border-white" />
          <div className="absolute bottom-40 right-40 w-48 h-48 rounded-full border border-white" />
        </div>
        <div className="relative z-10 text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="drop-shadow-2xl mb-5">
              <svg width="88" height="88" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="22" fill="#1e3a5f"/>
                <rect x="44" y="18" width="12" height="64" rx="6" fill="#C4973A"/>
                <rect x="18" y="44" width="64" height="12" rx="6" fill="#C4973A"/>
              </svg>
            </div>
            <h1 className="font-display text-4xl mb-2 tracking-tight">
              <span className="text-white font-bold">totali</span><span style={{color:"#C4973A"}}>·</span><span className="text-navy-300 font-light">finance</span>
            </h1>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{color:"#C4973A"}}>
              Confiança que soma
            </p>
          </div>
          <p className="text-navy-300 text-lg max-w-sm mx-auto">
            Controle financeiro empresarial conectado ao seu escritório contábil
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { label: 'Clientes', value: 'Multi-empresa' },
              { label: 'Integração', value: 'Domínio' },
              { label: 'Segurança', value: 'LGPD' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-white font-display font-semibold">{item.value}</p>
                <p className="text-navy-400 text-sm">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="w-full lg:w-[420px] bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-navy-800 rounded-xl flex items-center justify-center">
              <span className="text-gold-500 font-display font-bold text-xl">T</span>
            </div>
            <div>
              <p className="font-display font-bold text-navy-800">TotaliFinance</p>
              <p className="text-xs text-slate-400">Totali Contabilidade</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display font-semibold text-navy-800 text-2xl">
              Bem-vindo
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Acesse sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">E-mail</label>
              <input
                type="email"
                className="input-field"
                placeholder="seu@email.com.br"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="input-label">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                             hover:text-slate-600 transition-colors"
                  onClick={() => setShowSenha(!showSenha)}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-navy-600 hover:text-navy-800 hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm
                              px-4 py-3 rounded-lg">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                 rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            Totali Contabilidade · Itabaiana/SE
          </p>
        </div>
      </div>
    </div>
  );
}
