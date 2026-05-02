import { Bell } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { nomeRole, nomePerfil } from '../../utils/formatters';

export default function Header({ title }) {
  const { user, role, tenant } = useAuthStore();

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center
                        justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="font-display font-semibold text-navy-800 text-base">{title}</h1>
        {tenant && (
          <p className="text-xs text-slate-400 -mt-0.5">
            {tenant.nomeFantasia || tenant.razaoSocial}
            {role && (
              <span className="ml-1.5 text-navy-600 font-medium">
                · {nomeRole(role)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notificações */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600
                           hover:bg-slate-100 rounded-lg transition-colors">
          <Bell size={18} />
          {/* Badge de não lidas */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full" />
        </button>

        {/* Info do usuário */}
        <div className="text-right">
          <p className="text-xs font-medium text-slate-700">{user?.nome}</p>
          <p className="text-[10px] text-slate-400">{nomePerfil(user?.perfil)}</p>
        </div>
      </div>
    </header>
  );
}
