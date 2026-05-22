import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ClientesPage from './pages/ClientesPage'
import PipelinePage from './pages/PipelinePage'
import TarefasPage from './pages/TarefasPage'
import PerfilPage from './pages/PerfilPage'
import EquipePage from './pages/EquipePage'
import RelatoriosPage from './pages/RelatoriosPage'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
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
      <Route path="/tarefas" element={
        <PrivateRoute>
          <Layout><TarefasPage /></Layout>
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
      <Route path="/equipe" element={
        <PrivateRoute>
          <Layout><EquipePage /></Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
