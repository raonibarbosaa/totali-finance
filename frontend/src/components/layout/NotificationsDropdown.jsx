import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Inbox, Cloud, FileText } from 'lucide-react';
import api from '../../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRelative(raw) {
  if (!raw) return '';
  const d   = new Date(raw);
  const now = new Date();
  const diffMs  = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1)  return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHr  < 24) return `há ${diffHr} h`;
  if (diffDay < 7)  return `há ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`;
  return d.toLocaleDateString('pt-BR');
}

const TIPO_ICONS = {
  ofx_imported:  Cloud,
  ofx_duplicate: Cloud,
  default:       FileText,
};

const TIPO_COLORS = {
  ofx_imported:  'text-emerald-500 bg-emerald-50',
  ofx_duplicate: 'text-blue-500 bg-blue-50',
  default:       'text-slate-400 bg-slate-50',
};

// ─── Componente ──────────────────────────────────────────────────────────────
export default function NotificationsDropdown() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const containerRef                      = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setUnreadCount(res.data?.data?.count ?? 0);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.data ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Carrega contador ao montar + a cada 60s
  useEffect(() => {
    fetchUnreadCount();
    const t = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(t);
  }, [fetchUnreadCount]);

  // Quando abre o dropdown, busca as notificações
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Fechar ao clicar fora
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function handleMarkRead(notif) {
    if (notif.lida) return;
    try {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, lida: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      setUnreadCount(0);
    } catch {}
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-gold-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-100 shadow-xl rounded-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-[#152740]">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <CheckCheck size={12} /> Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Inbox className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm text-slate-500">Nenhuma notificação ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {notifications.map(n => {
                  const Icon  = TIPO_ICONS[n.tipo]  || TIPO_ICONS.default;
                  const color = TIPO_COLORS[n.tipo] || TIPO_COLORS.default;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleMarkRead(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 ${!n.lida ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-700 leading-tight">
                              {n.titulo || 'Notificação'}
                            </p>
                            {!n.lida && (
                              <span className="w-2 h-2 bg-gold-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          {n.mensagem && (
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.mensagem}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">{formatRelative(n.criadoEm)}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
