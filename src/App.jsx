import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RatingsGateProvider, useRatingsGate } from './contexts/RatingsGateContext'
import { lazyWithRetry } from './lib/lazyWithRetry'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'

// Cada tela vira um arquivo separado, baixado só quando a pessoa abre aquela
// aba. Antes o app baixava TUDO de uma vez (Relatórios, Ligações, Agenda...)
// antes de mostrar a primeira tela — pesado em celular fraco e internet ruim.
// O Login fica junto do principal de propósito: é a primeira coisa que abre.
const Dashboard          = lazyWithRetry(() => import('./pages/Dashboard'), 'dashboard')
const ClientesPage       = lazyWithRetry(() => import('./pages/ClientesPage'), 'clientes')
const PipelinePage       = lazyWithRetry(() => import('./pages/PipelinePage'), 'pipeline')
const PerfilPage         = lazyWithRetry(() => import('./pages/PerfilPage'), 'perfil')
const EquipePage         = lazyWithRetry(() => import('./pages/EquipePage'), 'equipe')
const RelatoriosPage     = lazyWithRetry(() => import('./pages/RelatoriosPage'), 'relatorios')
const LigacoesPage       = lazyWithRetry(() => import('./pages/LigacoesPage'), 'ligacoes')
const VisitasHojePage    = lazyWithRetry(() => import('./pages/VisitasHojePage'), 'hoje')
const AgendaPage         = lazyWithRetry(() => import('./pages/AgendaPage'), 'agendas')
const GoogleCallbackPage = lazyWithRetry(() => import('./pages/GoogleCallbackPage'), 'google')

// Spinner com SAÍDA: passando de 12s, quem está esperando ganha um botão de
// recarregar. Antes, app preso = fechar nos 3 riscos do celular — foi
// exatamente a reclamação que originou esta correção.
function Spinner() {
  const [demorou, setDemorou] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDemorou(true), 12000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-8" style={{ background: '#0A0A0A' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
      {demorou && (
        <div style={{ textAlign: 'center', maxWidth: '280px' }}>
          <p style={{ fontSize: '13px', color: '#B0A99F', lineHeight: 1.5, marginBottom: '14px' }}>
            Está demorando mais que o normal. Sua internet pode ter caído ao trocar de app.
          </p>
          <button onClick={() => window.location.reload()}
            style={{ padding: '11px 22px', borderRadius: '14px', fontSize: '14px', fontWeight: 700, background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', border: 'none', color: '#F0EAD6', cursor: 'pointer' }}>
            Recarregar o app
          </button>
        </div>
      )}
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
          {/* Enquanto o pedaço da tela baixa, mostra o mesmo spinner de sempre */}
          <Suspense fallback={<Spinner />}>
            <AppRoutes />
          </Suspense>
        </RatingsGateProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
