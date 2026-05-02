import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute, AdminRoute } from './routes/PrivateRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import SelecionarEmpresa from './pages/SelecionarEmpresa';
import DashboardCliente from './pages/cliente/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import Clientes from './pages/admin/Clientes';
import AdminUsuarios from './pages/admin/Usuarios';
import ContasBancarias from './pages/cliente/ContasBancarias';
import Categorias from './pages/cliente/Categorias';
import PadroesOFX from './pages/cliente/PadroesOFX';
import ConfiguracaoEmpresa from './pages/cliente/ConfiguracaoEmpresa';
import Lancamentos from './pages/cliente/Lancamentos';
import Extrato from './pages/cliente/Extrato';
import ContasPagarReceber from './pages/ContasPagarReceber';
import ImportacaoOFX from './pages/ImportacaoOFX';
import DRE from './pages/DRE';
import DFC from './pages/DFC';
import Estoque from './pages/Estoque';
import ExportacaoDominio from './pages/ExportacaoDominio';
import FechamentoCompetencia from './pages/FechamentoCompetencia';
import ComparativoMensal from './pages/ComparativoMensal';
import PainelAdmin from './pages/PainelAdmin';
import { AdminFechamentosPage, UsuariosEmpresaPage } from './pages/Placeholders';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/selecionar-empresa" element={<PrivateRoute requireTenant={false}><SelecionarEmpresa /></PrivateRoute>} />
        <Route path="/app" element={<PrivateRoute requireTenant={true}><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardCliente />} />
          <Route path="lancamentos" element={<Lancamentos />} />
          <Route path="contas-pagar" element={<ContasPagarReceber />} />
          <Route path="contas-receber" element={<ContasPagarReceber />} />
          <Route path="extrato" element={<Extrato />} />
          <Route path="importacao-ofx" element={<ImportacaoOFX />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="padroes-ofx" element={<PadroesOFX />} />
          <Route path="contas-bancarias" element={<ContasBancarias />} />
          <Route path="configuracao" element={<ConfiguracaoEmpresa />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="relatorios/dre" element={<DRE />} />
          <Route path="relatorios/dfc" element={<DFC />} />
          <Route path="relatorios/comparativo" element={<ComparativoMensal />} />
          <Route path="exportacao-dominio" element={<ExportacaoDominio />} />
          <Route path="fechamento" element={<FechamentoCompetencia />} />
          <Route path="usuarios" element={<UsuariosEmpresaPage />} />
        </Route>
        <Route path="/admin" element={<PrivateRoute requireTenant={false}><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PainelAdmin />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
          <Route path="fechamentos" element={<AdminFechamentosPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
