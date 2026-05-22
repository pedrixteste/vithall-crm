import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, X } from 'lucide-react'
import ClienteForm from '../components/ClienteForm'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { Card } from '../components/ui/Card'
import { Badge, STAGE_BADGES } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

export default function ClientesPage() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name')
    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) return (
    <ClienteDetalhe client={selected} onBack={() => { setSelected(null); fetchClients() }} />
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Gestão</p>
          <h1 style={{ color: '#EFEFEF' }}>Clientes</h1>
        </div>
        <Button onClick={() => setShowForm(true)} size="md">
          <Plus size={15} /> Novo
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#333030' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empresa ou contato..."
          className="w-full pl-11 pr-10 py-3.5 rounded-xl text-sm outline-none transition-all"
          style={{ background: '#161616', border: '1px solid #303030', color: '#EFEFEF' }}
          onFocus={e => e.target.style.borderColor = '#C9A84C'}
          onBlur={e => e.target.style.borderColor = '#303030'}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X size={13} style={{ color: '#6B6560' }} />
          </button>
        )}
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-xs" style={{ color: '#333030' }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-4">🏢</p>
          <p className="text-sm font-medium mb-1" style={{ color: '#6B6560' }}>Nenhum cliente encontrado</p>
          <p className="text-xs" style={{ color: '#333030' }}>Toque em "Novo" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => (
            <Card key={client.id} hover onClick={() => setSelected(client)}>
              <div className="flex items-center gap-5" style={{ padding: '24px 28px' }}>
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base"
                  style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
                  {client.company_name?.[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>
                    {client.company_name}
                  </p>
                  {client.contact_name && (
                    <p className="text-xs truncate mt-0.5" style={{ color: '#6B6560' }}>
                      {client.contact_name}{client.contact_role ? ` · ${client.contact_role}` : ''}
                    </p>
                  )}
                  <div className="mt-3">{STAGE_BADGES[client.matricula_stage]}</div>
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
