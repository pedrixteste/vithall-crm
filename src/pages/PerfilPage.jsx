import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { User, LogOut, Check } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export default function PerfilPage() {
  const { profile, signOut, user } = useAuth()
  const [name, setName] = useState(profile?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
