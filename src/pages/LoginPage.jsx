import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

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
    <div className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: 'radial-gradient(ellipse at top, #140810 0%, #0A0A0A 60%)' }}>

      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,28,58,0.12) 0%, transparent 65%)',
          filter: 'blur(30px)',
        }} />
      </div>

      <div className="w-full max-w-[340px] relative z-10 animate-in">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="px-5 py-3 rounded-2xl" style={{ background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src="/logo.png" alt="Vithall" className="h-14 object-contain" />
          </div>
        </div>

        {/* Texto */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] mb-1.5" style={{ color: '#C9A84C' }}>
            Área do Vendedor
          </p>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#EFEFEF' }}>Bem-vindo de volta</h1>
          <p className="text-sm" style={{ color: '#6B6560' }}>Entre com suas credenciais para continuar</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: '#1A1A1A', border: '1px solid #252525', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                style={{ background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.15)', color: '#E85555' }}>
                <span>⚠</span> {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-[11px]" style={{ color: '#252525' }}>
          Vithall Treinamentos © 2025
        </p>
      </div>
    </div>
  )
}
