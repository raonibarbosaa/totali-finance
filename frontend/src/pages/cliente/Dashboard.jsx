import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, Users, Activity
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

function CategoriaCard({ titulo, itens, tipo }) {
  const total = itens.reduce((s, i) => s + i.total, 0);
  const cor = tipo === 'receita' ? 'text-emerald-600' : 'text-red-500';
  const corBarra = tipo === 'receita' ? 'bg-emerald-500' : 'bg-red-400';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-display font-semibold text-navy-800 text-sm">{titulo}</h3>
      </div>
      <div className="card-body">
        {itens.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum lançamento no período</p>
        ) : (
          <div className="space-y-3">
            {itens.map((item, idx) => {
              const percent = total > 0 ? (item.total / total) * 100 : 0;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-sm text-slate-700 truncate flex-1 min-w-0">{item.categoria}</p>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-sm font-medium ${cor}`}>{formatCurrency(item.total)}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{percent.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${corBarra}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Alerta de qualidade dos dados:
// mostra lançamentos efetivados do mês corrente que não têm categoria.
// Só renderiza se houver pelo menos 1 — fica invisível quando tudo OK.
function SemCategoriaAlert({ data }) {
  if (!data || data.count === 0) return null;
  const { count, items } = data;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-sm font-semibold text-amber-900">
              {count} lançamento{count > 1 ? 's' : ''} sem categoria neste mês
            </p>
            <a href="/app/lancamentos?categoryId=__sem__"
              className="text-xs font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap flex-shrink-0">
              Ver todos →
            </a>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Lançamentos sem categoria podem comprometer relatórios e exportação contábil.
            Edite-os para classificar corretamente.
          </p>
          {items.length > 0 && (
            <div className="space-y-1.5 border-t border-amber-200 pt-2.5">
              {items.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 truncate flex-1 min-w-0">
                    <span className="text-slate-400">{formatDate(t.dataLancamento)}</span>
                    {' · '}
                    {t.descricao}
                  </span>
                  <span className={`font-medium flex-shrink-0 ${
                    t.tipo === 'receita' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {t.tipo === 'receita' ? '+' : '-'}{formatCurrency(Math.abs(t.valor))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardCliente() {
  const { tenant } = useAuthStore();
  const { hasRole } = useRole();
  const [stats, setStats] = useState(null);
  const [titulos, setTitulos] = useState([]);
  const [semCategoria, setSemCategoria] = useState({ count: 0, items: [] });
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
          distribuicaoLucros: raw.distribuicaoLucros || 0,
          saldoTotal: raw.saldoTotal || 0,
          titulosAVencer: raw.titulosVencer || 0,
          categorias: raw.categorias || { receitas: [], despesas: [] },
        } : null);
        setSemCategoria(raw?.lancamentosSemCategoria || { count: 0, items: [] });
        setTitulos(titulosRes.data.data?.data || []);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
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
              {(() => {
                const resultado = (stats?.receitasMes || 0) - (stats?.despesasMes || 0);
                const positivo  = resultado >= 0;
                return (
                  <StatCard
                    label="Resultado do mês"
                    value={formatCurrency(resultado)}
                    icon={positivo ? TrendingUp : TrendingDown}
                    color={positivo ? 'bg-emerald-600' : 'bg-red-600'}
                    trendLabel="receitas − despesas"
                  />
                );
              })()}
              <StatCard
                label="Distribuição de Lucros"
                value={formatCurrency(stats?.distribuicaoLucros || 0)}
                icon={Users}
                color="bg-amber-500"
              />
              <StatCard
                label="Saldo disponível"
                value={formatCurrency(stats?.saldoTotal || 0)}
                icon={Wallet}
                color="bg-navy-700"
              />
            </>
          )}
        </div>
      )}

      {/* Alerta: lançamentos sem categoria — só nível 2+ */}
      {hasRole(2) && !loading && <SemCategoriaAlert data={semCategoria} />}

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

      {/* Demonstrativo por categoria - somente nivel 1 e 2 */}
      {hasRole(2) && stats?.categorias && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoriaCard
            titulo="Receitas por categoria"
            itens={stats.categorias.receitas}
            tipo="receita"
          />
          <CategoriaCard
            titulo="Despesas por categoria"
            itens={stats.categorias.despesas}
            tipo="despesa"
          />
        </div>
      )}

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
