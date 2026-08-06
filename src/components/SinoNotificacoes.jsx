import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from '../lib/useRefreshOnFocus'

// Quantas notificações o sino guarda na tela. Ninguém rola além disso —
// o resto continua no banco (a faxina apaga com 60 dias).
const LIMITE = 30

// Ícone por tipo. Ajuda a bater o olho e saber o que é sem ler.
const ICONE = {
  briefing: '🌅',
  recorde:  '🏆',
  visita:   '📅',
  estrela:  '⭐',
  lembrete: '🔔',
  tarefa:   '✅',
}

/** "agora", "há 20 min", "há 3 h", "ontem", "24/07" */
function quando(iso) {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1)   return 'agora'
  if (min < 60)  return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `há ${h} h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'ontem'
  if (dias < 7)   return `há ${dias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function SinoNotificacoes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState([])
  // Quais estavam por ler no momento em que o painel abriu. Elas são marcadas
  // como lidas no banco na hora (senão o pontinho voltaria), mas continuam
  // destacadas na tela enquanto o painel está aberto — senão a pessoa abre e
  // não enxerga qual era a novidade.
  const [novasNaAbertura, setNovasNaAbertura] = useState(new Set())

  // Devolve a lista buscada além de guardá-la no estado: quem abre o painel
  // precisa saber o que estava por ler AGORA, e o estado só chega no próximo
  // render (aí a marcação de lidas rodaria em cima da lista velha).
  const buscar = useCallback(async () => {
    if (!user) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, url, kind, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE)
    // A tabela pode ainda não existir (migração não rodada) — o sino
    // simplesmente não aparece, em vez de quebrar o cabeçalho inteiro.
    if (error) return []
    setItens(data || [])
    return data || []
  }, [user])

  useEffect(() => { buscar() }, [buscar])
  useRefreshOnFocus(buscar)

  const naoLidas = itens.filter(n => !n.read_at)

  async function abrir() {
    const abrindo = !aberto
    setAberto(abrindo)
    if (!abrindo) return

    const lista = await buscar()
    const porLer = lista.filter(n => !n.read_at)
    setNovasNaAbertura(new Set(porLer.map(n => n.id)))
    if (!porLer.length) return

    // O pontinho vermelho significa "chegou coisa nova desde a última vez que
    // você abriu" — então abrir já dá baixa em tudo.
    const agora = new Date().toISOString()
    setItens(prev => prev.map(n => n.read_at ? n : { ...n, read_at: agora }))
    await supabase.from('notifications')
      .update({ read_at: agora })
      .eq('user_id', user.id)
      .is('read_at', null)
  }

  function tocar(n) {
    setAberto(false)
    if (n.url) navigate(n.url)
  }

  return (
    <>
      <button onClick={abrir} aria-label="Notificações"
        className="relative flex items-center justify-center rounded-xl transition-all"
        style={{ width: '34px', height: '34px', background: '#1A1A1A', border: '1px solid #252525' }}>
        <Bell size={16} style={{ color: naoLidas.length ? '#C9A84C' : '#6B6560' }} />
        {naoLidas.length > 0 && (
          <span className="absolute rounded-full"
            style={{ top: '6px', right: '6px', width: '7px', height: '7px',
                     background: '#EF4444', border: '1.5px solid #1A1A1A' }} />
        )}
      </button>

      {aberto && (
        <>
          {/* Fecha ao tocar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />

          <div className="fixed z-50 rounded-2xl overflow-hidden shadow-2xl"
            style={{ top: '60px', right: '12px', left: 'auto', width: 'min(360px, calc(100vw - 24px))',
                     background: '#111111', border: '1px solid #252525' }}>

            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: '#1C1C1C' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9A84C' }}>
                Notificações
              </span>
              {itens.length > 0 && (
                <span className="text-[10px]" style={{ color: '#6B6560' }}>últimos 60 dias</span>
              )}
            </div>

            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {itens.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: '#6B6560' }}>Nada por aqui ainda.</p>
                  <p className="text-xs mt-1" style={{ color: '#6E6862' }}>
                    Tudo que for enviado pra você aparece aqui, mesmo que o celular não avise.
                  </p>
                </div>
              ) : itens.map(n => {
                const nova = novasNaAbertura.has(n.id)
                // Os títulos vindos das functions já começam com emoji ("📅 Nova
                // visita agendada") — aí o ícone do tipo sairia duplicado.
                const icone = /^\p{Extended_Pictographic}/u.test(n.title) ? null : (ICONE[n.kind] || '🔔')
                return (
                  <button key={n.id} onClick={() => tocar(n)}
                    className="w-full text-left px-4 py-3 border-b transition-all"
                    style={{ borderColor: '#161616', background: nova ? 'rgba(201,168,76,0.05)' : 'transparent',
                             cursor: n.url ? 'pointer' : 'default' }}>
                    <div className="flex items-start gap-2.5">
                      {icone && <span className="text-base leading-none mt-0.5">{icone}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate"
                            style={{ color: nova ? '#E8E4DF' : '#8A837C' }}>{n.title}</span>
                          {nova && <span className="rounded-full flex-shrink-0"
                            style={{ width: '6px', height: '6px', background: '#C9A84C' }} />}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#6B6560', lineHeight: 1.45 }}>{n.body}</p>
                        <p className="text-[10px] mt-1" style={{ color: '#6E6862' }}>{quando(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
