import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { User, LogOut, Check, Calendar, Unlink } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { getGoogleAuthUrl } from '../lib/googleCalendar'

export default function PerfilPage() {
  const { profile, signOut, user } = useAuth()
  const [name, setName] = useState(profile?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)

  const isGoogleConnected = !!profile?.google_refresh_token

  async function handleDisconnectGoogle() {
    if (!confirm('Desconectar o Google Agenda? Os eventos já criados não serão afetados.')) return
    setDisconnecting(true)
    await supabase.from('profiles').update({
      google_access_token:  null,
      google_refresh_token: null,
      google_token_expiry:  null,
    }).eq('id', user.id)
    setDisconnecting(false)
    window.location.reload()
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', user.id)

    if (error) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      window.location.reload()
    }
    setSaving(false)
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>
          Configurações
        </p>
        <h1 style={{ color: '#EFEFEF' }}>Perfil</h1>
      </div>

      {/* Avatar */}
      <div className="flex justify-center py-6">
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(123,28,58,0.4), rgba(201,168,76,0.3))',
            border: '1px solid rgba(201,168,76,0.2)',
          }}>
          <span className="text-4xl font-bold" style={{ color: '#C9A84C' }}>
            {name?.[0]?.toUpperCase() || <User size={36} />}
          </span>
        </div>
      </div>

      {/* Formulário */}
      <Card>
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <Input
            label="Nome de exibição"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Pedro Silva"
          />

          <div>
            <label className="block mb-2 text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: '#6B6560' }}>
              E-mail
            </label>
            <p className="text-sm px-4 py-3 rounded-xl"
              style={{ background: '#111', border: '1px solid #1C1C1C', color: '#6B6560' }}>
              {user?.email}
            </p>
          </div>

          {error && (
            <p className="text-xs px-4 py-3 rounded-xl"
              style={{ color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.15)' }}>
              {error}
            </p>
          )}

          <Button type="submit" disabled={saving || !name.trim()} className="w-full" size="lg">
            {saved ? (
              <><Check size={15} /> Salvo!</>
            ) : saving ? 'Salvando...' : 'Salvar nome'}
          </Button>
        </form>
      </Card>

      {/* Google Agenda */}
      <Card>
        <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: isGoogleConnected ? 'rgba(74,222,128,0.1)' : 'rgba(107,101,96,0.1)',
              border: `1px solid ${isGoogleConnected ? 'rgba(74,222,128,0.25)' : '#252525'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calendar size={18} style={{ color: isGoogleConnected ? '#4ADE80' : '#6B6560' }} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#EFEFEF' }}>Google Agenda</p>
              <p style={{ fontSize: '11px', color: isGoogleConnected ? '#4ADE80' : '#6B6560', marginTop: '2px' }}>
                {isGoogleConnected ? 'Conectado — visitas sincronizam automaticamente' : 'Não conectado'}
              </p>
            </div>
          </div>

          {isGoogleConnected ? (
            <button onClick={handleDisconnectGoogle} disabled={disconnecting}
              style={{
                width: '100%', padding: '13px', borderRadius: '14px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                background: 'rgba(232,85,85,0.08)', color: '#E85555',
                border: '1px solid rgba(232,85,85,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
              <Unlink size={15} />
              {disconnecting ? 'Desconectando...' : 'Desconectar Google Agenda'}
            </button>
          ) : (
            <a href={getGoogleAuthUrl()} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '13px', borderRadius: '14px', textDecoration: 'none',
              fontSize: '14px', fontWeight: 600,
              background: 'rgba(201,168,76,0.08)', color: '#C9A84C',
              border: '1px solid rgba(201,168,76,0.2)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Conectar Google Agenda
            </a>
          )}

          {!isGoogleConnected && (
            <p style={{ fontSize: '11px', color: '#3A3A3A', lineHeight: 1.5 }}>
              Ao conectar, visitas agendadas aparecem automaticamente no Google Agenda.
              Quando o cliente cancelar, o evento é removido sozinho.
            </p>
          )}
        </div>
      </Card>

      {/* Sair */}
      <Card>
        <div className="p-6">
          <p className="text-xs mb-4" style={{ color: '#6B6560' }}>
            Sessão atual logada como <span style={{ color: '#EFEFEF' }}>{user?.email}</span>
          </p>
          <Button variant="danger" className="w-full" size="lg" onClick={signOut}>
            <LogOut size={15} /> Sair da conta
          </Button>
        </div>
      </Card>
    </div>
  )
}
