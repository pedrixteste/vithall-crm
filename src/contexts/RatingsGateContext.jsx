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
      setPending(await fetchPendingRatings(user.id))
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
