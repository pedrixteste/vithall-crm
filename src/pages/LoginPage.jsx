import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError('E-mail ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'linear-gradient(145deg, #0D0D0D 0%, #1a0a12 50%, #0D0D0D 100%)' }}>

      {/* Glow de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,28,58,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-36 mx-auto mb-5 rounded-2xl overflow-hidden flex items-center justify-center p-3"
            style={{
              background: '#fff',
              boxShadow: '0 0 40px rgba(201,168,76,0.15), 0 0 80px rgba(123,28,58,0.1)'
            }}>
            <img src="/logo.png" alt="Vithall" className="w-full object-contain" />
          </div>
          <p style={{ color: '#7A7570', fontSize: '14px' }}>Gestão comercial de alta performance</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7" style={{
          background: '#1E1E1E',
          border: '1px solid #2A2A2A',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
        }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#7A7570', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{
                  background: '#161616',
                  border: '1px solid #2A2A2A',
                  color: '#F0EAD6',
                }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#7A7570', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{
                  background: '#161616',
                  border: '1px solid #2A2A2A',
                  color: '#F0EAD6',
                }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-center py-2 px-3 rounded-lg"
                style={{ color: '#E88080', background: 'rgba(232,128,128,0.08)', border: '1px solid rgba(232,128,128,0.15)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: loading ? '#2A2A2A' : 'linear-gradient(135deg, #7B1C3A, #C9A84C)',
                color: loading ? '#7A7570' : '#F0EAD6',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(201,168,76,0.2)',
                letterSpacing: '0.03em'
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: '#3A3530' }}>
          Vithall Treinamentos © 2025
        </p>
      </div>
    </div>
  )
}
