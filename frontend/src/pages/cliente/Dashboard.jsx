import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useRole from '../../hooks/useRole';
import { formatCurrency, formatDate } from '../../utils/formatters';

function StatCard({ label, value, icon: Icon, color, trend, trendLabel }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5
            ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-display font-semibold text-navy-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {trendLabel && <p className="text-[10px] text-slate-400 mt-0.5">{trendLabel}</p>}
    </div>
  );
}

function TituloRow({ titulo }) {
  const vencido = new Date(titulo.dataVencimento) < new Date();
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate">{titulo.descricao}</p>
        <p className={`text-xs mt-0.5 ${vencido ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
          {vencido ? 'Vencido em ' : 'Vence em '}
          {formatDate(titulo.dataVencimento)}
        </p>
      </div>
      <span className={`text-sm font-medium ml-4 flex-shrink-0 ${
        titulo.tipo === 'receber' ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {titulo.tipo === 'receber' ? '+' : '-'}{formatCurrency(titulo.valor)}
      </span>
    </div>
  );
}

export default function DashboardCliente() {
  const { tenant } = useAuthStore();
  const { hasRole } = useRole();
  const [stats, setStats] = useState(null);
  const [titulos, setTitulos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, titulosRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/titles?status=aberto&limit=8&orderBy=dataVencimento'),
        ]);
        const raw = statsRes.data.data;
        setStats(raw ? {
          receitasMes: raw.receitas || 0,
          despesasMes: raw.despesas || 0,
          saldoTotal: raw.saldoTotal || 0,
          titulosAVencer: raw.titulosVencer || 0,
        } : null);
        setTitulos(titulosRes.data.data?.titles || []);
      } catch (_) {}
      setLoading(false);
    }
    load();
  }, [tenant?.id]);

  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h2 className="font-display font-semibold text-navy-800 text-xl">
          Olá! Aqui está o resumo de {mes}.
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {tenant?.nomeFantasia || tenant?.razaoSocial}
        </p>
      </div>

      {/* Cards de estatísticas — somente nível 1 e 2 */}
      {hasRole(2) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="w-10 h-10 bg-slate-100 rounded-xl mb-3" />
                <div className="h-7 bg-slate-100 rounded w-24 mb-1" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                label="Receitas do mês"
                value={formatCurrency(stats?.receitasMes || 0)}
                icon={TrendingUp}
                color="bg-emerald-500"
              />
              <StatCard
                label="Despesas do mês"
                value={formatCurrency(stats?.despesasMes || 0)}
                icon={TrendingDown}
                color="bg-red-500"
              />
              <StatCard
                label="Saldo disponível"
                value={formatCurrency(stats?.saldoTotal || 0)}
                icon={Wallet}
                color="bg-navy-700"
              />
              <StatCard
                label="Títulos a vencer"
                value={stats?.titulosAVencer || 0}
                icon={Clock}
                color="bg-gold-500"
                trendLabel="próximos 7 dias"
              />
            </>
          )}
        </div>
      )}

      {/* Títulos em aberto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A pagar */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <ArrowDownRight size={16} className="text-red-500" />
              <h3 className="font-display font-semibold text-navy-800 text-sm">
                Contas a Pagar
              </h3>
            </div>
            <a href="/app/contas-pagar"
              className="text-xs text-navy-600 hover:text-navy-800 font-medium">
              Ver todas →
            </a>
          </div>
          <div className="card-body py-1">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
                ))}
              </div>
            ) : titulos.filter(t => t.tipo === 'pagar').length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-300" />
                <p className="text-sm">Nenhuma conta em aberto</p>
              </div>
            ) : (
              titulos
                .filter(t => t.tipo === 'pagar')
                .slice(0, 5)
                .map(t => <TituloRow key={t.id} titulo={t} />)
            )}
          </div>
        </div>

        {/* A receber */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <ArrowUpRight size={16} className="text-emerald-500" />
              <h3 className="font-display font-semibold text-navy-800 text-sm">
                Contas a Receber
              </h3>
            </div>
            <a href="/app/contas-receber"
              className="text-xs text-navy-600 hover:text-navy-800 font-medium">
              Ver todas →
            </a>
          </div>
          <div className="card-body py-1">
            {loading ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
                ))}
              </div>
            ) : titulos.filter(t => t.tipo === 'receber').length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-300" />
                <p className="text-sm">Nenhum recebimento em aberto</p>
              </div>
            ) : (
              titulos
                .filter(t => t.tipo === 'receber')
                .slice(0, 5)
                .map(t => <TituloRow key={t.id} titulo={t} />)
            )}
          </div>
        </div>
      </div>

      {/* Aviso nível 3 */}
      {!hasRole(2) && (
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-navy-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-navy-800">Acesso Básico</p>
            <p className="text-xs text-navy-600 mt-0.5">
              Seu nível de acesso permite lançamentos e gestão de títulos.
              Para visualizar saldos, extrato e relatórios, solicite acesso Operacional ao responsável da empresa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
