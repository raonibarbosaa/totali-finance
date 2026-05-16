import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES = {
  '/app/dashboard':          'Dashboard',
  '/app/lancamentos':        'Lançamentos',
  '/app/contas-pagar':       'Contas a Pagar',
  '/app/contas-receber':     'Contas a Receber',
  '/app/contas-bancarias':   'Contas Bancárias',
  '/app/extrato':            'Extrato Bancário',
  '/app/importacao-ofx':     'Importação OFX',
  '/app/integracao-drive':   'Integração Google Drive',
  '/app/conciliacao':        'Conciliação',
  '/app/categorias':         'Categorias',
  '/app/padroes-ofx':        'Padrões OFX',
  '/app/configuracao':       'Configuração da Empresa',
  '/app/estoque':            'Controle de Estoque',
  '/app/recorrencias-fixas': 'Recorrências Fixas',
  '/app/fornecedores':       'Fornecedores',
  '/app/clientes':           'Clientes',
  '/app/relatorios/dre':     'DRE — Demonstração do Resultado',
  '/app/relatorios/dfc':     'DFC — Fluxo de Caixa',
  '/app/exportacao-dominio': 'Exportação Domínio Contábil',
  '/app/fechamento':         'Fechamento de Competência',
  '/app/usuarios':           'Usuários',
  '/admin/dashboard':        'Painel Totali',
  '/admin/clientes':         'Clientes',
  '/admin/usuarios':         'Usuários Totali',
  '/admin/fechamentos':      'Fechamentos',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'TotaliFinance';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">

      {/* Backdrop mobile — clica fora pra fechar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-6">
          <div className="animate-fade-in max-w-7xl relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
