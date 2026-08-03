import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchPendingRatings } from '../lib/visitConfirmation'

// Centraliza as visitas passadas sem avaliação (a "estrelinha") do usuário.
// Enquanto houver alguma, o app trava tudo menos a aba Hoje (e a ficha do
// cliente, que abre dentro dela). Fonte única, com refresh após avaliar.
const RatingsGateContext = createContext({ pending: [], loading: true, refresh: async () => {} })

export function RatingsGateProvider({ children }) {
  const { user, profile } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  const isVisitor = profile?.role === 'vendedor' || profile?.role === 'gerente'

  const refresh = useCallback(async () => {
    if (!user?.id || !isVisitor) { setPending([]); setLoading(false); return }
    try {
      // A trava não pode segurar a abertura do app: se a consulta não responder
      // (rede que o Android congelou ao trocar de app), a tela abre e a trava
      // volta sozinha no próximo refresh. Sem isto, esta era a SEGUNDA porta
      // para o spinner infinito, mesmo com o login já resolvido.
      const r = await Promise.race([
        fetchPendingRatings(user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 10000)),
      ])
      if (r) setPending(r)
    } finally {
      setLoading(false)
    }
  }, [user?.id, isVisitor])

  useEffect(() => { setLoading(true); refresh() }, [refresh])

  return (
    <RatingsGateContext.Provider value={{ pending, loading, refresh }}>
      {children}
    </RatingsGateContext.Provider>
  )
}

export const useRatingsGate = () => useContext(RatingsGateContext)
