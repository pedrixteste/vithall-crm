import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { User, LogOut, Check, Calendar, Unlink, Smartphone, Bell } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { getGoogleAuthUrl, clearGoogleTokens } from '../lib/googleCalendar'
import { enablePushNotifications, getNotificationPermission, reactivatePush } from '../lib/onesignal'
import { colorInfo, GOOGLE_EVENT_COLORS } from '../lib/calendarColors'

export default function PerfilPage() {
  const { profile: authProfile, signOut, user } = useAuth()
  const [freshProfile, setFreshProfile] = useState(authProfile)
  const [name, setName] = useState(authProfile?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  // Instalar como app (manifest, sem service worker)
  const [canInstall, setCanInstall] = useState(() => !!window.__installPrompt)
  const [installed, setInstalled]   = useState(false)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  // Notificações push
  const [pushPerm, setPushPerm] = useState(getNotificationPermission())
  const [enablingPush, setEnablingPush] = useState(false)

  async function handleEnablePush() {
    setEnablingPush(true)
    await enablePushNotifications()
    setPushPerm(getNotificationPermission())
    setEnablingPush(false)
  }

  const [reactivating, setReactivating] = useState(false)
  const [reactivated, setReactivated]   = useState(false)
  async function handleReactivate() {
    setReactivating(true)
    const id = await reactivatePush()
    setReactivating(false)
    setReactivated(!!id)
    if (!id) alert('Não consegui reativar. Feche o app, abra de novo e tente; se persistir, limpe os dados do site no navegador.')
  }

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setFreshProfile(data) })
  }, [user?.id])

  useEffect(() => {
    const onReady = () => setCanInstall(true)
    window.addEventListener('installprompt-ready', onReady)
    return () => window.removeEventListener('installprompt-ready', onReady)
  }, [])

  async function handleInstall() {
    const prompt = window.__installPrompt
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      window.__installPrompt = null
      setCanInstall(false)
    }
  }

  const profile = freshProfile
  const isGoogleConnected = !!freshProfile?.google_connected

  const [savingColor, setSavingColor] = useState(false)
  async function saveColor(id) {
    setSavingColor(true)
    const { error } = await supabase.from(`profiles`).update({ calendar_color: id }).eq(`id`, freshProfile.id)
    if (!error) setFreshProfile(p => ({ ...p, calendar_color: id }))
    setSavingColor(false)
  }

  async function handleDisconnectGoogle() {
    if (!confirm('Desconectar o Google Agenda? Os eventos já criados não serão afetados.')) return
    setDisconnecting(true)
    await clearGoogleTokens(user.id)
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

          {/* Cor dos eventos criados pelo CRM na agenda da própria pessoa.
              Editável: como o evento nasce na agenda de quem marca, duas
              pessoas escolherem a mesma cor não atrapalha ninguém — o que
              distingue os colegas é a agenda, não a cor do evento.
              São 11 e não as ~24 da tela do Google: a API recusa as demais
              ("Invalid color id value"). */}
          <div className="rounded-2xl" style={{ background: '#111', border: '1px solid #1C1C1C', padding: '14px 16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#EFEFEF' }}>
              Cor das suas marcações
            </p>
            <p style={{ fontSize: '11px', color: '#6B6560', lineHeight: 1.45, marginTop: '2px', marginBottom: '12px' }}>
              Os horários que você ocupar entram nessa cor na sua agenda do Google.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(GOOGLE_EVENT_COLORS).map(([id, c]) => {
                const ativa = String(freshProfile?.calendar_color) === id
                return (
                  <button key={id} type="button" title={c.nome}
                    onClick={() => saveColor(id)} disabled={savingColor}
                    style={{
                      width: '34px', height: '34px', borderRadius: '10px', background: c.hex,
                      border: ativa ? '2px solid #EFEFEF' : '1px solid rgba(255,255,255,0.12)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: '15px', lineHeight: 1,
                    }}>
                    {ativa ? '✓' : ''}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: '11px', color: '#555050', marginTop: '10px' }}>
              {colorInfo(freshProfile?.calendar_color)
                ? `Escolhida: ${colorInfo(freshProfile.calendar_color).nome}`
                : 'Sem cor escolhida — o Google usa a cor padrão da sua agenda.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Notificações push */}
      <Card>
        <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: pushPerm === 'granted' ? 'rgba(74,222,128,0.1)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${pushPerm === 'granted' ? 'rgba(74,222,128,0.25)' : 'rgba(34,211,238,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={18} style={{ color: pushPerm === 'granted' ? '#4ADE80' : '#22D3EE' }} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#EFEFEF' }}>Notificações</p>
              <p style={{ fontSize: '11px', color: pushPerm === 'granted' ? '#4ADE80' : '#6B6560', marginTop: '2px' }}>
                {pushPerm === 'granted' ? 'Ativadas — você recebe lembretes e o resumo do dia'
                  : pushPerm === 'denied' ? 'Bloqueadas no navegador'
                  : 'Ative para receber lembretes e o resumo do dia'}
              </p>
            </div>
          </div>

          {pushPerm === 'default' && (
            <button onClick={handleEnablePush} disabled={enablingPush}
              style={{
                width: '100%', padding: '13px', borderRadius: '14px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                background: 'rgba(34,211,238,0.1)', color: '#22D3EE',
                border: '1px solid rgba(34,211,238,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
              <Bell size={15} /> {enablingPush ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}

          {/* "Ativadas" mas não chega? A inscrição pode ter morrido num
              bloquear→desbloquear. Reinscreve do zero e regrava o id. */}
          {pushPerm === 'granted' && (
            <button onClick={handleReactivate} disabled={reactivating}
              style={{
                width: '100%', padding: '11px', borderRadius: '14px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: reactivated ? 'rgba(74,222,128,0.12)' : '#111',
                color: reactivated ? '#4ADE80' : '#6B6560',
                border: `1px solid ${reactivated ? 'rgba(74,222,128,0.3)' : '#252525'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
              <Bell size={14} />
              {reactivating ? 'Reativando...' : reactivated ? '✓ Reativado — teste agora' : 'Não está recebendo? Reativar'}
            </button>
          )}
          {pushPerm === 'denied' && (
            <div className="rounded-xl" style={{ padding: '12px 14px', background: '#111', border: '1px solid #1C1C1C' }}>
              <p style={{ fontSize: '12px', color: '#B0A99F', lineHeight: 1.6 }}>
                {isIOS
                  ? <>No iPhone, as notificações só funcionam com o app <b style={{ color: '#EFEFEF' }}>adicionado à tela inicial</b>. Depois, permita nos Ajustes do celular.</>
                  : <>Você bloqueou as notificações. Para ativar, toque no <b style={{ color: '#EFEFEF' }}>cadeado</b> ao lado do endereço do site e permita as notificações.</>}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Instalar como app na tela inicial */}
      <Card>
        <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: (isStandalone || installed) ? 'rgba(74,222,128,0.1)' : 'rgba(201,168,76,0.08)',
              border: `1px solid ${(isStandalone || installed) ? 'rgba(74,222,128,0.25)' : 'rgba(201,168,76,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Smartphone size={18} style={{ color: (isStandalone || installed) ? '#4ADE80' : '#C9A84C' }} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#EFEFEF' }}>App na tela inicial</p>
              <p style={{ fontSize: '11px', color: (isStandalone || installed) ? '#4ADE80' : '#6B6560', marginTop: '2px' }}>
                {isStandalone || installed
                  ? 'Instalado — você já está usando como app'
                  : 'Use o Vithall CRM como um aplicativo de verdade'}
              </p>
            </div>
          </div>

          {!isStandalone && !installed && (
            canInstall ? (
              <button onClick={handleInstall}
                style={{
                  width: '100%', padding: '13px', borderRadius: '14px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', color: '#F0EAD6',
                  border: 'none', boxShadow: '0 2px 12px rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                <Smartphone size={15} /> Adicionar à tela inicial
              </button>
            ) : (
              <div className="rounded-xl" style={{ padding: '12px 14px', background: '#111', border: '1px solid #1C1C1C' }}>
                <p style={{ fontSize: '12px', color: '#B0A99F', lineHeight: 1.6 }}>
                  {isIOS
                    ? <>No iPhone: toque em <b style={{ color: '#EFEFEF' }}>Compartilhar</b> (quadrado com seta ↑) e depois em <b style={{ color: '#EFEFEF' }}>"Adicionar à Tela de Início"</b>.</>
                    : <>No menu do navegador (⋮), toque em <b style={{ color: '#EFEFEF' }}>"Adicionar à tela inicial"</b> ou <b style={{ color: '#EFEFEF' }}>"Instalar app"</b>.</>}
                </p>
              </div>
            )
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
