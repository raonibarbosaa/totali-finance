import { Menu } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';
import useAuthStore from '../../store/authStore';
import { nomeRole, nomePerfil } from '../../utils/formatters';

export default function Header({ title, onMenuClick }) {
  const { user, role, tenant } = useAuthStore();

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center
                        justify-between px-4 md:px-6 flex-shrink-0">

      <div className="flex items-center gap-3">
        {/* Hamburger — só aparece no mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-700
                     hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 className="font-display font-semibold text-navy-800 text-sm md:text-base leading-tight">
            {title}
          </h1>
          {tenant && (
            <p className="text-xs text-slate-400 -mt-0.5 hidden sm:block">
              {tenant.nomeFantasia || tenant.razaoSocial}
              {role && (
                <span className="ml-1.5 text-navy-600 font-medium">
                  · {nomeRole(role)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <NotificationsDropdown />

        {/* Info do usuário — oculta no mobile pequeno */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-slate-700">{user?.nome}</p>
          <p className="text-[10px] text-slate-400">{nomePerfil(user?.perfil)}</p>
        </div>
      </div>
    </header>
  );
}
