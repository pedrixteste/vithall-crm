import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Exportado para as bancadas de teste (src/dev-*.jsx) conseguirem desenhar um
// componente logado sem subir o app inteiro. O app usa sempre o useAuth abaixo.
export const AuthContext = createContext({})

// Prazo da abertura do app. Nada aqui pode prender a tela: se a rede não
// responder, o app abre com o que dá para saber e se conserta depois.
const AUTH_TIMEOUT_MS = 8000

// Resolve com { __timeout: true } em vez de ficar pendurado para sempre
function comTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve({ __timeout: true }), ms)),
  ])
}

// Sessão que o supabase-js guarda no navegador. É o plano B quando o
// getSession() não responde a tempo: a pessoa continua logada (o token é
// renovado na primeira consulta que funcionar) em vez de cair no login.
function sessaoSalva() {
  try {
    const chave = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!chave) return null
    const bruto = JSON.parse(localStorage.getItem(chave))
    return bruto?.user ? bruto : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Quem está sem perfil e precisa de nova tentativa. É o coração do conserto:
  // várias telas não carregam nada sem saber o papel da pessoa (o Dashboard
  // literalmente não busca dados enquanto `profile` for nulo), então perder o
  // perfil numa piscada de internet deixava o app girando para sempre.
  const perfilPendenteRef = useRef(null)
  const tentandoRef       = useRef(false)

  useEffect(() => {
    let vivo = true

    ;(async () => {
      let r
      // Falhar aqui não pode derrubar a abertura: sem o catch, uma rejeição
      // (rede abortada) viraria erro solto e a tela ficaria no spinner.
      try {
        r = await comTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS)
      } catch {
        r = { __timeout: true }
      }
      if (!vivo) return
      // Não respondeu a tempo → segue com a sessão guardada no aparelho
      const session = r?.__timeout ? sessaoSalva() : r?.data?.session
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // NUNCA chamar o supabase direto aqui dentro: o cliente segura um lock
        // interno durante este callback e a query trava (spinner infinito ao
        // voltar pro app após o refresh do token). setTimeout(0) sai do lock.
        const uid = session.user.id
        setTimeout(() => fetchProfile(uid), 0)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  // Quando o app volta ao primeiro plano ou a internet volta, tenta de novo o
  // perfil que ficou faltando. É isto que faz o app se consertar sozinho em
  // vez de a pessoa ter que fechá-lo nos 3 riscos do celular.
  useEffect(() => {
    function tentarDeNovo() {
      const uid = perfilPendenteRef.current
      if (!uid || tentandoRef.current) return
      if (document.visibilityState !== 'visible') return
      fetchProfile(uid)
    }
    document.addEventListener('visibilitychange', tentarDeNovo)
    window.addEventListener('online', tentarDeNovo)
    return () => {
      document.removeEventListener('visibilitychange', tentarDeNovo)
      window.removeEventListener('online', tentarDeNovo)
    }
  }, [])

  // Busca o perfil sem nunca segurar a tela: o app abre e o perfil chega
  // depois. Enquanto não vier, insiste com espera crescente (2s, 4s, 8s… até
  // 30s) e sem desistir — desistir era o que deixava o app inutilizável até
  // ser fechado à força.
  async function fetchProfile(userId, tentativa = 1) {
    if (tentandoRef.current) return
    tentandoRef.current = true
    let r
    try {
      r = await comTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        AUTH_TIMEOUT_MS,
      )
    } catch {
      r = { __timeout: true }
    } finally {
      tentandoRef.current = false
    }
    setLoading(false)

    if (r?.__timeout || r?.error || !r?.data) {
      perfilPendenteRef.current = userId
      const espera = Math.min(2000 * 2 ** (tentativa - 1), 30000)
      setTimeout(() => {
        if (perfilPendenteRef.current === userId) fetchProfile(userId, tentativa + 1)
      }, espera)
      return
    }
    perfilPendenteRef.current = null
    setProfile(r.data)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
