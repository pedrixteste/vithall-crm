import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RatingsGateProvider, useRatingsGate } from './contexts/RatingsGateContext'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ClientesPage from './pages/ClientesPage'
import PipelinePage from './pages/PipelinePage'
import PerfilPage from './pages/PerfilPage'
import EquipePage from './pages/EquipePage'
import RelatoriosPage from './pages/RelatoriosPage'
import LigacoesPage from './pages/LigacoesPage'
import VisitasHojePage from './pages/VisitasHojePage'
import AgendaPage from './pages/AgendaPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import Layout from './components/Layout'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )
}

// Trava global: com visitas pendentes de avaliação, só a aba Hoje (/agenda)
// é acessível — a ficha do cliente pra avaliar abre dentro dela. Qualquer
// outra rota é redirecionada para /agenda.
function RatingsGate({ children }) {
  const location = useLocation()
  const { pending, loading } = useRatingsGate()
  if (location.pathname === '/agenda') return children
  if (loading) return <Spinner />
  if (pending.length > 0) return <Navigate to="/agenda" replace />
  return children
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <RatingsGate>{children}</RatingsGate>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout><Dashboard /></Layout>
        </PrivateRoute>
      } />
      <Route path="/clientes" element={
        <PrivateRoute>
          <Layout><ClientesPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/pipeline" element={
        <PrivateRoute>
          <Layout><PipelinePage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/perfil" element={
        <PrivateRoute>
          <Layout><PerfilPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/relatorios" element={
        <PrivateRoute>
          <Layout><RelatoriosPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/agenda" element={
        <PrivateRoute>
          <Layout><VisitasHojePage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/agendas" element={
        <PrivateRoute>
          <Layout><AgendaPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/ligacoes" element={
        <PrivateRoute>
          <Layout><LigacoesPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/equipe" element={
        <PrivateRoute>
          <Layout><EquipePage /></Layout>
        </PrivateRoute>
      } />
      {/* Callback OAuth do Google — sem Layout, sem autenticação obrigatória */}
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RatingsGateProvider>
          <AppRoutes />
        </RatingsGateProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
