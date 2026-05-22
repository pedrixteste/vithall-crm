import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, X, SlidersHorizontal } from 'lucide-react'
import ClienteForm from '../components/ClienteForm'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { Card } from '../components/ui/Card'
import { STAGE_BADGES } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

const STAGE_OPTIONS = [
  { key: 'nao_marcou',     label: 'Nao marcou',    color: '#6B6560' },
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

export default function ClientesPage() {
  const { profile, user } = useAuth()
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

  useEffect(() => { fetchClients() }, [profile])

  async function fetchClients() {
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (profile?.role === 'pre_vendas') {
      query = query.eq('created_by', user.id)
    } else if (profile?.role === 'vendedor') {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }
    // gerente: sem filtro, ve tudo
    const { data } = await query
    setClients(data || [])
    setLoading(false)
  }

  function clearFilters() {
    setFilterStage('')
    setFilterPeriod('')
    setFilterFrom('')
    setFilterTo('')
  }

  const activeFilters = [filterStage, filterPeriod].filter(Boolean).length

  const filtered = clients.filter(c => {
    const matchesSearch = !search ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase())

    const matchesStage = !filterStage || c.matricula_stage === filterStage

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

    return matchesSearch && matchesStage && matchesDate
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
              placeholder="Buscar empresa ou contato..."
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
                    {!client.assigned_to && profile?.role === 'pre_vendas' && (
                      <span title="Nao atribuido a nenhum vendedor" style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                    )}
                  </div>
                  {client.contact_name && client.company_name && (
                    <p className="text-xs truncate mt-0.5" style={{ color: '#6B6560' }}>
                      {client.company_name}{client.contact_role ? ` · ${client.contact_role}` : ''}
                    </p>
                  )}
                  <div style={{ marginTop: '10px' }}>{STAGE_BADGES[client.matricula_stage]}</div>
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
