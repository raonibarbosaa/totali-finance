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
  '/app/categorias':         'Categorias',
  '/app/padroes-ofx':        'Padrões OFX',
  '/app/configuracao':       'Configuração da Empresa',
  '/app/estoque':            'Controle de Estoque',
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
 