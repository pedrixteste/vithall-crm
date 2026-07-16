import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, X, SlidersHorizontal, Phone } from 'lucide-react'
import ClienteForm from '../components/ClienteForm'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { Card } from '../components/ui/Card'
import { STAGE_BADGES } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

const OUTCOME_OPTIONS = [
  { key: 'matriculada',          label: 'Matriculada',        icon: '✅', color: '#4ADE80' },
  { key: 'grandes_chances',      label: 'Grandes chances',    icon: '🔥', color: '#C9A84C' },
  { key: 'chance_futura',        label: 'Chance futura',      icon: '🔮', color: '#60A5FA' },
  { key: 'sem_chance',           label: 'Sem chance',         icon: '🚫', color: '#E85555' },
  { key: 'retorno_pessoalmente', label: 'Retorno presencial', icon: '📍', color: '#A78BFA' },
  { key: 'retorno_ligacao',      label: 'Retorno ligação',    icon: '📞', color: '#E8834A' },
  { key: 'remarcar',             label: 'Remarcar',           icon: '📅', color: '#22D3EE' },
]

const STAGE_OPTIONS = [
  { key: 'nao_marcou',     label: 'Nao marcou',    color: '#6B6560' },
  { key: 'marcado',        label: 'Marcado',        color: '#22D3EE' },
  { key: 'nao_visitado',   label: 'Nao visitado',  color: '#60A5FA' },
  { key: 'nao_apareceu',   label: 'Nao apareceu',  color: '#E8834A' },
  { key: 'recebeu_visita', label: 'Recebeu visita', color: '#A78BFA' },
  { key: 'matriculado',    label: 'Matriculado!!', color: '#4ADE80' },
]

const PERIOD_OPTIONS = [
  { key: 'week',   label: '1 semana' },
  { key: 'month',  label: '1 mes' },
  { key: 'year',   label: '1 ano' },
  { key: 'custom', label: 'Personalizado' },
]

function normalizeCity(city) {
  return city.trim().split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function ClientesPage() {
  const { profile, user } = useAuth()
  const [searchParams] = useSearchParams()

  const [clients, setClients]       = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterStage, setFilterStage] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterHasDone, setFilterHasDone]   = useState([])
  const [filterNotDone, setFilterNotDone]   = useState([])
  const [filterRating, setFilterRating]     = useState('')
  const [filterSource, setFilterSource]     = useState('')   // '' | 'mine' | 'pre_vendas'
  const [filterOutcome, setFilterOutcome]   = useState(() => searchParams.get('outcome') || '')
  const [preVendasIds, setPreVendasIds]     = useState(new Set())
  const [phoneCounts, setPhoneCounts]       = useState({}) // telefone → nº de registros (todos os usuários)

  // Abre painel de filtros automaticamente se vier com filtro pela URL
  useEffect(() => {
    if (searchParams.get('outcome')) setShowFilters(true)
  }, [])

  useEffect(() => {
    async function fetchPreVendasIds() {
      const { data } = await supabase.from('profiles').select('id').eq('role', 'pre_vendas')
      setPreVendasIds(new Set((data || []).map(p => p.id)))
    }
    if (profile?.role === 'gerente' || profile?.role === 'vendedor') fetchPreVendasIds()
  }, [profile])

  useEffect(() => { fetchClients() }, [profile])

  async function fetchClients() {
    let query = supabase.from('clients').select('*, visits(id, rating, visit_outcome)').order('created_at', { ascending: false })
    if (profile?.role === 'pre_vendas') {
      query = query.eq('created_by', user.id)
    } else if (profile?.role === 'vendedor') {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }
    // gerente: sem filtro, ve tudo
    const { data } = await query
    setClients(data || [])
    setLoading(false)

    // Conta registros por telefone (base toda, igual ao histórico do contato 📞ˣ)
    const { data: phones } = await supabase.from('clients').select('phone')
    const counts = {}
    for (const p of phones || []) if (p.phone) counts[p.phone] = (counts[p.phone] || 0) + 1
    setPhoneCounts(counts)
  }

  function clearFilters() {
    setFilterStage('')
    setFilterPeriod('')
    setFilterFrom('')
    setFilterTo('')
    setFilterCity('')
    setFilterHasDone([])
    setFilterNotDone([])
    setFilterRating('')
    setFilterSource('')
    setFilterOutcome('')
  }

  const activeFilters = [
    filterStage, filterPeriod, filterCity, filterRating, filterSource, filterOutcome,
    filterHasDone.length > 0 ? 'hasDone' : '',
    filterNotDone.length > 0 ? 'notDone' : '',
  ].filter(Boolean).length

  // Cidades unicas normalizadas (case-insensitive)
  const uniqueCities = (() => {
    const map = new Map()
    clients.forEach(c => {
      if (c.city?.trim()) {
        const key = c.city.trim().toLowerCase()
        if (!map.has(key)) map.set(key, normalizeCity(c.city))
      }
    })
    return [...map.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  })()

  const q = search.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '') // busca por telefone ignora formatação

  const filtered = clients.filter(c => {
    const matchesSearch = !q ||
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      (qDigits && (c.phone || '').replace(/\D/g, '').includes(qDigits)) ||
      (qDigits && (c.phone2 || '').replace(/\D/g, '').includes(qDigits))

    const matchesStage   = !filterStage || c.matricula_stage === filterStage
    const matchesCity    = !filterCity  || c.city?.trim().toLowerCase() === filterCity.toLowerCase()
    const matchesHasDone = filterHasDone.length === 0 ||
      filterHasDone.some(t => (c.matriculas || []).includes(t))
    const matchesNotDone = filterNotDone.length === 0 ||
      filterNotDone.every(t => !(c.matriculas || []).includes(t))

    let matchesDate = true
    if (filterPeriod) {
      const created = new Date(c.created_at)
      const now = new Date()
      if (filterPeriod === 'week') {
        const ago = new Date(now); ago.setDate(ago.getDate() - 7)
        matchesDate = created >= ago
      } else if (filterPeriod === 'month') {
        const ago = new Date(now); ago.setMonth(ago.getMonth() - 1)
        matchesDate = created >= ago
      } else if (filterPeriod === 'year') {
        const ago = new Date(now); ago.setFullYear(ago.getFullYear() - 1)
        matchesDate = created >= ago
      } else if (filterPeriod === 'custom') {
        if (filterFrom) matchesDate = created >= new Date(filterFrom)
        if (filterTo)   matchesDate = matchesDate && created <= new Date(filterTo + 'T23:59:59')
      }
    }

    const matchesRating  = !filterRating  ||
      (c.visits || []).some(v => v.rating === filterRating)

    const matchesOutcome = !filterOutcome ||
      (filterOutcome === 'retorno'
        ? (c.visits || []).some(v => v.visit_outcome === 'retorno_pessoalmente' || v.visit_outcome === 'retorno_ligacao')
        : (c.visits || []).some(v => v.visit_outcome === filterOutcome))

    const matchesSource = !filterSource ||
      (filterSource === 'mine'       && c.created_by === user.id) ||
      (filterSource === 'pre_vendas' && preVendasIds.has(c.created_by))

    return matchesSearch && matchesStage && matchesDate && matchesCity && matchesHasDone && matchesNotDone && matchesRating && matchesOutcome && matchesSource
  })

  if (selected) return (
    <ClienteDetalhe client={selected} onBack={() => { setSelected(null); fetchClients() }} />
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Gestao</p>
          <h1 style={{ color: '#EFEFEF' }}>Clientes</h1>
        </div>
        <Button onClick={() => setShowForm(true)} size="md">
          <Plus size={15} /> Novo
        </Button>
      </div>

      {/* Busca + filtro */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#333030' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contato, empresa ou telefone..."
              className="w-full pl-11 pr-10 rounded-xl text-sm outline-none transition-all"
              style={{ padding: '12px 12px 12px 40px', background: '#161616', border: '1px solid #303030', color: '#EFEFEF' }}
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#303030'}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X size={13} style={{ color: '#6B6560' }} />
              </button>
            )}
          </div>

          {/* Botao de filtro */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all"
            style={{
              padding: '12px 16px',
              background: showFilters || activeFilters > 0 ? 'rgba(201,168,76,0.12)' : '#161616',
              border: `1px solid ${showFilters || activeFilters > 0 ? 'rgba(201,168,76,0.35)' : '#303030'}`,
              color: activeFilters > 0 ? '#C9A84C' : '#6B6560',
            }}>
            <SlidersHorizontal size={15} />
            {activeFilters > 0 && (
              <span className="text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#C9A84C', color: '#0A0A0A' }}>
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Filtro de origem — gerente e vendedor */}
        {(profile?.role === 'gerente' || profile?.role === 'vendedor') && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: '',           label: 'Todos' },
              { key: 'mine',       label: 'Meus' },
              { key: 'pre_vendas', label: 'Do pré-vendas' },
            ].map(opt => {
              const active = filterSource === opt.key
              return (
                <button key={opt.key} type="button"
                  onClick={() => setFilterSource(opt.key)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{
                    padding: '6px 14px',
                    background: active ? 'rgba(201,168,76,0.14)' : '#161616',
                    border: `1px solid ${active ? 'rgba(201,168,76,0.45)' : '#2A2A2A'}`,
                    color: active ? '#C9A84C' : '#6B6560',
                  }}>
                  {active && '✓ '}{opt.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Painel de filtros */}
        {showFilters && (
          <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>

            {/* Etapa do funil */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
              Etapa do funil
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
              {STAGE_OPTIONS.map(s => (
                <button key={s.key} type="button"
                  onClick={() => setFilterStage(f => f === s.key ? '' : s.key)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{
                    padding: '5px 12px',
                    background: filterStage === s.key ? `${s.color}18` : 'transparent',
                    border: `1px solid ${filterStage === s.key ? s.color + '50' : '#2A2A2A'}`,
                    color: filterStage === s.key ? s.color : '#6B6560',
                  }}>
                  {filterStage === s.key ? '✓ ' : ''}{s.label}
                </button>
              ))}
            </div>

            {/* Cidade */}
            {uniqueCities.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
                  Cidade
                </p>
                <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
                  {uniqueCities.map(city => (
                    <button key={city} type="button"
                      onClick={() => setFilterCity(f => f.toLowerCase() === city.toLowerCase() ? '' : city)}
                      className="text-xs font-semibold rounded-full transition-all"
                      style={{
                        padding: '5px 12px',
                        background: filterCity.toLowerCase() === city.toLowerCase() ? 'rgba(96,165,250,0.12)' : 'transparent',
                        border: `1px solid ${filterCity.toLowerCase() === city.toLowerCase() ? 'rgba(96,165,250,0.4)' : '#2A2A2A'}`,
                        color: filterCity.toLowerCase() === city.toLowerCase() ? '#60A5FA' : '#6B6560',
                      }}>
                      {filterCity.toLowerCase() === city.toLowerCase() ? '✓ ' : ''}{city}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Fez o treinamento */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
              Fez o treinamento
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
              {['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall'].map(t => {
                const active = filterHasDone.includes(t)
                return (
                  <button key={t} type="button"
                    onClick={() => setFilterHasDone(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
                    className="text-xs font-semibold rounded-full transition-all"
                    style={{
                      padding: '5px 12px',
                      background: active ? 'rgba(74,222,128,0.12)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(74,222,128,0.4)' : '#2A2A2A'}`,
                      color: active ? '#4ADE80' : '#6B6560',
                    }}>
                    {active ? '✓ ' : ''}{t}
                  </button>
                )
              })}
            </div>

            {/* Ainda nao fez */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
              Ainda nao fez
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
              {['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall'].map(t => {
                const active = filterNotDone.includes(t)
                return (
                  <button key={t} type="button"
                    onClick={() => setFilterNotDone(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
                    className="text-xs font-semibold rounded-full transition-all"
                    style={{
                      padding: '5px 12px',
                      background: active ? 'rgba(232,131,74,0.12)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(232,131,74,0.4)' : '#2A2A2A'}`,
                      color: active ? '#E8834A' : '#6B6560',
                    }}>
                    {active ? '✗ ' : ''}{t}
                  </button>
                )
              })}
            </div>

            {/* Periodo */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
              Periodo de cadastro
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: filterPeriod === 'custom' ? '12px' : '0' }}>
              {PERIOD_OPTIONS.map(p => (
                <button key={p.key} type="button"
                  onClick={() => setFilterPeriod(f => f === p.key ? '' : p.key)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{
                    padding: '5px 12px',
                    background: filterPeriod === p.key ? 'rgba(201,168,76,0.12)' : 'transparent',
                    border: `1px solid ${filterPeriod === p.key ? 'rgba(201,168,76,0.4)' : '#2A2A2A'}`,
                    color: filterPeriod === p.key ? '#C9A84C' : '#6B6560',
                  }}>
                  {filterPeriod === p.key ? '✓ ' : ''}{p.label}
                </button>
              ))}
            </div>

            {/* Datas personalizadas */}
            {filterPeriod === 'custom' && (
              <div className="flex gap-2" style={{ marginTop: '10px' }}>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#444040' }}>De</p>
                  <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                    className="w-full text-xs rounded-xl outline-none"
                    style={{ padding: '8px 12px', background: '#111', border: '1px solid #252525', color: '#EFEFEF' }}
                    onFocus={e => e.target.style.borderColor = '#C9A84C'}
                    onBlur={e => e.target.style.borderColor = '#252525'}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#444040' }}>Ate</p>
                  <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                    className="w-full text-xs rounded-xl outline-none"
                    style={{ padding: '8px 12px', background: '#111', border: '1px solid #252525', color: '#EFEFEF' }}
                    onFocus={e => e.target.style.borderColor = '#C9A84C'}
                    onBlur={e => e.target.style.borderColor = '#252525'}
                  />
                </div>
              </div>
            )}

            {/* Resultado da visita */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040', marginTop: '16px' }}>
              Resultado da visita
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
              {/* Opção combinada: qualquer retorno */}
              {(() => {
                const active = filterOutcome === 'retorno'
                return (
                  <button key="retorno" type="button"
                    onClick={() => setFilterOutcome(f => f === 'retorno' ? '' : 'retorno')}
                    className="text-xs font-semibold rounded-full transition-all"
                    style={{
                      padding: '5px 12px',
                      background: active ? '#60A5FA18' : 'transparent',
                      border: `1px solid ${active ? '#60A5FA60' : '#2A2A2A'}`,
                      color: active ? '#60A5FA' : '#6B6560',
                    }}>
                    🔄 {active ? '✓ ' : ''}Retornos
                  </button>
                )
              })()}
              {OUTCOME_OPTIONS.map(o => (
                <button key={o.key} type="button"
                  onClick={() => setFilterOutcome(f => f === o.key ? '' : o.key)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{
                    padding: '5px 12px',
                    background: filterOutcome === o.key ? o.color + '18' : 'transparent',
                    border: `1px solid ${filterOutcome === o.key ? o.color + '60' : '#2A2A2A'}`,
                    color: filterOutcome === o.key ? o.color : '#6B6560',
                  }}>
                  {o.icon} {filterOutcome === o.key ? '✓ ' : ''}{o.label}
                </button>
              ))}
            </div>

            {/* Nota da visita */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
              Nota da visita
            </p>
            <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '4px' }}>
              {[
                { key: 'pessima',  label: 'Péssima',  color: '#E85555' },
                { key: 'razoavel', label: 'Razoável', color: '#E8834A' },
                { key: 'boa',      label: 'Boa',      color: '#60A5FA' },
                { key: 'otima',    label: 'Ótima',    color: '#4ADE80' },
              ].map(r => (
                <button key={r.key} type="button"
                  onClick={() => setFilterRating(f => f === r.key ? '' : r.key)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{
                    padding: '5px 12px',
                    background: filterRating === r.key ? r.color + '18' : 'transparent',
                    border: `1px solid ${filterRating === r.key ? r.color + '60' : '#2A2A2A'}`,
                    color: filterRating === r.key ? r.color : '#6B6560',
                  }}>
                  {filterRating === r.key ? '✓ ' : ''}{r.label}
                </button>
              ))}
            </div>

            {/* Limpar filtros */}
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="text-xs font-semibold mt-3"
                style={{ color: '#E85555' }}>
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-xs" style={{ color: '#333030' }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {activeFilters > 0 ? ' (filtrado)' : ''}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center" style={{ padding: '64px 0' }}>
          <p className="text-3xl mb-4">🏢</p>
          <p className="text-sm font-medium mb-1" style={{ color: '#6B6560' }}>Nenhum cliente encontrado</p>
          <p className="text-xs" style={{ color: '#333030' }}>
            {activeFilters > 0 ? 'Tente ajustar os filtros' : 'Toque em "Novo" para adicionar'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(client => (
            <Card key={client.id} hover onClick={() => setSelected(client)}>
              <div className="flex items-center gap-5" style={{ padding: '20px 24px' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base"
                  style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
                  {(client.contact_name || client.company_name)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>
                      {client.contact_name || client.company_name}
                    </p>
                    {(phoneCounts[client.phone] || 0) > 1 && (
                      <span title={`Contato registrado outras ${phoneCounts[client.phone] - 1}x`}
                        className="inline-flex items-center flex-shrink-0 rounded-full"
                        style={{ padding: '2px 7px', gap: '1px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA', fontSize: '10px', fontWeight: 700 }}>
                        <Phone size={10} /><sup>{phoneCounts[client.phone] - 1}</sup>
                      </span>
                    )}
                    {!client.assigned_to && profile?.role === 'pre_vendas' && (
                      <span title="Nao atribuido a nenhum vendedor" style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                    )}
                  </div>
                  {client.contact_name && client.company_name && (
                    <p className="text-xs truncate mt-0.5" style={{ color: '#6B6560' }}>
                      {client.company_name}{client.contact_role ? ` · ${client.contact_role}` : ''}
                    </p>
                  )}
                  {client.phone && (
                    <p className="text-xs truncate mt-0.5 flex items-center gap-1.5" style={{ color: '#555050' }}>
                      <Phone size={10} style={{ flexShrink: 0 }} /> {client.phone}{client.phone2 ? ` · ${client.phone2}` : ''}
                    </p>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    {client.matricula_stage === 'matriculado' && client.matriculas?.length > 0 ? (
                      <div className="flex flex-wrap" style={{ gap: '4px' }}>
                        {client.matriculas.map(t => (
                          <span key={t} className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full border"
                            style={{ color: '#4ADE80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.2)' }}>
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    ) : STAGE_BADGES[client.matricula_stage]}
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: '#333030', flexShrink: 0 }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <ClienteForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchClients() }} />
      )}
    </div>
  )
}
