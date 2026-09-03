import { Link } from 'react-router-dom';

/**
 * Moldura das telas públicas de autenticação (mesma identidade do Login).
 * Painel esquerdo institucional + painel direito com o formulário.
 */
export default function AuthShell({ titulo, subtitulo, children, voltarPara = '/login', voltarTexto = 'Voltar para o login' }) {
  return (
    <div className="min-h-screen bg-navy-800 flex">
      {/* Painel esquerdo — visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
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
                <rect width="100" height="100" rx="22" fill="#1e3a5f" />
                <rect x="44" y="18" width="12" height="64" rx="6" fill="#C4973A" />
                <rect x="18" y="44" width="64" height="12" rx="6" fill="#C4973A" />
              </svg>
            </div>
            <h1 className="font-display text-4xl mb-2 tracking-tight">
              <span className="text-white font-bold">totali</span><span style={{ color: '#C4973A' }}>·</span><span className="text-navy-300 font-light">finance</span>
            </h1>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: '#C4973A' }}>
              Confiança que soma
            </p>
          </div>
          <p className="text-navy-300 text-lg max-w-sm mx-auto">
            Controle financeiro empresarial conectado ao seu escritório contábil
          </p>
        </div>
      </div>

      {/* Painel direito — conteúdo */}
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
            <h2 className="font-display font-semibold text-navy-800 text-2xl">{titulo}</h2>
            {subtitulo && <p className="text-slate-500 text-sm mt-1">{subtitulo}</p>}
          </div>

          {children}

          {voltarPara && (
            <p className="text-center mt-6">
              <Link to={voltarPara} className="text-sm text-navy-700 hover:text-navy-800 hover:underline">
                {voltarTexto}
              </Link>
            </p>
          )}

          <p className="text-center text-xs text-slate-400 mt-8">
            Totali Contabilidade · Itabaiana/SE
          </p>
        </div>
      </div>
    </div>
  );
}
