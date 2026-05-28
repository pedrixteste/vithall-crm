// Página de callback OAuth — o Google redireciona aqui após autorizar
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Conectando Google Agenda...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const code  = new URLSearchParams(window.location.search).get('code')
    const error = new URLSearchParams(window.location.search).get('error')

    if (error || !code) {
      setStatus('Acesso negado ou expirado.')
      setIsError(true)
      setTimeout(() => navigate('/perfil'), 2500)
      return
    }

    async function exchange() {
      try {
        // Troca o code por tokens via Edge Function (client_secret fica seguro)
        const { data, error: fnError } = await supabase.functions.invoke('google-auth', {
          body: {
            action:       'exchange',
            code,
            redirect_uri: `${window.location.origin}/auth/google/callback`,
          },
        })

        if (fnError) throw new Error(`Função: ${fnError.message}`)
        if (data?.error) throw new Error(`Google: ${data.error} — ${data.error_description || ''}`)
        if (!data?.access_token) throw new Error(`Sem token. Resposta: ${JSON.stringify(data)}`)

        // Salva tokens no perfil do usuário
        const { data: authData } = await supabase.auth.getUser()
        const uid = authData?.user?.id
        if (!uid) throw new Error('Usuário não autenticado')

        const { error: updateError } = await supabase.from('profiles').update({
          google_access_token:  data.access_token,
          google_refresh_token: data.refresh_token || null,
          google_token_expiry:  Date.now() + (data.expires_in || 3600) * 1000,
        }).eq('id', uid)

        if (updateError) throw new Error(`Salvar perfil: ${updateError.message}`)

        setStatus('Google Agenda conectado! ✅')
        setTimeout(() => navigate('/perfil'), 1800)
      } catch (e) {
        console.error('Google OAuth error:', e)
        setStatus(e.message || 'Erro ao conectar.')
        setIsError(true)
        setTimeout(() => navigate('/perfil'), 5000)
      }
    }

    exchange()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#080808', padding: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px', margin: '0 auto 20px',
          background: isError ? 'rgba(232,85,85,0.1)' : 'rgba(74,222,128,0.1)',
          border: `1px solid ${isError ? 'rgba(232,85,85,0.25)' : 'rgba(74,222,128,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>
          {isError ? '❌' : '📅'}
        </div>
        <p style={{ color: '#EFEFEF', fontWeight: 600, fontSize: '16px' }}>{status}</p>
        <p style={{ color: '#3A3A3A', fontSize: '12px', marginTop: '8px' }}>
          Redirecionando para o perfil...
        </p>
      </div>
    </div>
  )
}
