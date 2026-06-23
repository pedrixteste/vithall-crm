import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Clock, User, CalendarCheck } from 'lucide-react'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { STAGE_BADGES } from '../components/ui/Badge'
import VisitConfirmationList from '../components/VisitConfirmationList'
import { fetchVisitsToConfirm } from '../lib/visitConfirmation'

function getTodayRange() {
  const now = new Date()
  // Usa horário local do Brasil (UTC-3) convertido para ISO
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    start: `${y}-${m}-${d}T00:00:00`,
    end:   `${y}-${m}-${d}T23:59:59`,
    label: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

export default function VisitasHojePage() {
  const { profile, user } = useAuth()
  const [visits, setVisits]       = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [toConfirm, setToConfirm] = useState([])      // visitas (hoje+amanhã) que EU marquei
  const [confirmHidden, setConfirmHidden] = useState(false)

  const { start, end, label } = getTodayRange()

  // Quem FAZ visita vê a agenda de hoje; pré-vendas vê só as confirmações
  const isVisitor = profile?.role === 'vendedor' || profile?.role === 'gerente'

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    // Visitas que EU marquei (hoje + amanhã) ainda não confirmadas — todos os perfis
    if (user?.id) {
      setToConfirm(await fetchVisitsToConfirm(user.id))
      setConfirmHidden(false)
    }

    // Lista de "visitas de hoje" — só para quem faz visita (vendedor/gerente)
    if (isVisitor) {
      const { data: profs } = await supabase.from('profiles').select('id, name, role')
      setProfilesMap(Object.fromEntries((profs || []).map(p => [p.id, p])))

      let q = supabase
        .from('clients')
        .select('*')
        .not('visit_scheduled_at', 'is', null)
        .gte('visit_scheduled_at', start)
        .lte('visit_scheduled_at', end)
        .order('visit_scheduled_at', { ascending: true })

      if (profile?.role === 'vendedor') q = q.eq('assigned_to', user.id)
      // gerente: vê todas

      const { data } = await q
      setVisits(data || [])
    }

    setLoading(false)
  }

  if (selected) return (
    <ClienteDetalhe
      client={selected}
      onBack={() => { setSelected(null); fetchData() }}
      onUpdated={() => { setSelected(null); fetchData() }}
    />
  )

  const showConfirm = !confirmHidden && toConfirm.length > 0

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1 capitalize" style={{ color: '#C9A84C' }}>
          {label}
        </p>
        <h1 style={{ color: '#EFEFEF' }}>{isVisitor ? 'Visitas de Hoje' : 'Confirmar visitas'}</h1>
        <p className="text-sm mt-1.5" style={{ color: '#6B6560' }}>
          {loading ? '...' : isVisitor
            ? (visits.length === 0
                ? 'Nenhuma visita marcada para hoje'
                : `${visits.length} visita${visits.length > 1 ? 's' : ''} agendada${visits.length > 1 ? 's' : ''} hoje`)
            : (showConfirm
                ? 'Confirme suas marcações de hoje e amanhã'
                : 'Nada para confirmar agora')}
        </p>
      </div>

      {/* Confirmar visitas (hoje + amanhã) — para quem marcou. Destaque dourado p/ diferenciar das visitas do dia */}
      {!loading && showConfirm && (
        <div className="rounded-2xl" style={{ background: '#15140F', border: '1px solid rgba(201,168,76,0.22)', padding: '16px' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <CalendarCheck size={15} style={{ color: '#C9A84C' }} />
            <h2 className="text-sm font-bold" style={{ color: '#EFEFEF' }}>Confirmar visitas</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: '#6B6560' }}>
            {toConfirm.length} {toConfirm.length === 1 ? 'visita marcada' : 'visitas marcadas'} por você (hoje e amanhã). Confirme cada uma.
          </p>
          <VisitConfirmationList
            visits={toConfirm}
            onEmpty={() => setConfirmHidden(true)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center" style={{ paddingTop: '60px' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Pré-vendas: sem nada para confirmar */}
      {!loading && !isVisitor && !showConfirm && (
        <div className="flex flex-col items-center justify-center" style={{ paddingTop: '60px', gap: '12px' }}>
          <p style={{ fontSize: '3rem' }}>✅</p>
          <p className="text-sm font-medium" style={{ color: '#333030' }}>Nenhuma visita para confirmar</p>
        </div>
      )}

      {/* Visitas de hoje — só vendedor/gerente */}
      {!loading && isVisitor && (
        visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: '48px', gap: '12px' }}>
            <p style={{ fontSize: '3rem' }}>📅</p>
            <p className="text-sm font-medium" style={{ color: '#333030' }}>Dia livre de visitas!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {showConfirm && (
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mt-2" style={{ color: '#444040' }}>
                Agenda de hoje
              </p>
            )}
            {visits.map(v => {
              const dt          = new Date(v.visit_scheduled_at)
              const timeLabel   = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const isPast      = dt < new Date()
              const creator     = profilesMap[v.created_by]
              const byPreVendas = creator?.role === 'pre_vendas'
              const creatorName = creator?.name?.split(' ')[0] || '—'

              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="w-full text-left transition-all active:scale-[0.98]"
                  style={{
                    background: '#161616',
                    border: `1px solid ${isPast ? '#252525' : '#303030'}`,
                    borderRadius: '18px',
                    padding: '18px 20px',
                    opacity: isPast ? 0.65 : 1,
                  }}>

                  {/* Hora + badges de topo */}
                  <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                    <div className="flex items-center gap-2">
                      <Clock size={13} style={{ color: isPast ? '#E8834A' : '#4ADE80' }} />
                      <span className="text-sm font-bold tabular-nums"
                        style={{ color: isPast ? '#E8834A' : '#4ADE80' }}>
                        {timeLabel}
                      </span>
                      {isPast && (
                        <span className="text-[10px] font-semibold rounded-full"
                          style={{ padding: '2px 8px', background: 'rgba(232,131,74,0.1)', color: '#E8834A', border: '1px solid rgba(232,131,74,0.2)' }}>
                          já passou
                        </span>
                      )}
                    </div>

                    {/* Quem marcou */}
                    <div className="flex items-center gap-1.5">
                      <User size={11} style={{ color: byPreVendas ? '#60A5FA' : '#6B6560' }} />
                      <span className="text-[11px] font-semibold"
                        style={{ color: byPreVendas ? '#60A5FA' : '#6B6560' }}>
                        {byPreVendas ? `Pré-vendas · ${creatorName}` : 'Você'}
                      </span>
                    </div>
                  </div>

                  {/* Nome + empresa */}
                  <p className="text-base font-semibold" style={{ color: '#EFEFEF', marginBottom: '2px' }}>
                    {v.contact_name}
                  </p>
                  {v.company_name && (
                    <p className="text-sm" style={{ color: '#6B6560', marginBottom: '8px' }}>
                      {v.company_name}
                    </p>
                  )}

                  {/* Localização + estágio */}
                  <div className="flex items-center justify-between gap-2" style={{ marginTop: '8px' }}>
                    {(v.city || v.address_street) && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={11} style={{ color: '#444040', flexShrink: 0 }} />
                        <span className="text-xs truncate" style={{ color: '#444040' }}>
                          {[v.address_street, v.address_neighborhood, v.city].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex-shrink-0">
                      {STAGE_BADGES[v.matricula_stage] || null}
                    </div>
                  </div>

                  <p className="text-[11px] mt-3" style={{ color: '#2A2A2A' }}>
                    Toque para abrir o cliente →
                  </p>
                </button>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
