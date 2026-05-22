import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, X, Users } from 'lucide-react'
import ClienteForm from '../components/ClienteForm'
import ClienteDetalhe from '../components/ClienteDetalhe'

const STAGES = {
  lead: { label: 'Lead', color: '#7A7570', bg: 'rgba(122,117,112,0.12)' },
  negociacao: { label: 'Em negociação', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  proposta: { label: 'Proposta', color: '#9B5DE5', bg: 'rgba(155,93,229,0.12)' },
  fechado: { label: 'Fechado', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
}

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C9A84C' }}>Gestão</p>
          <h1 className="text-2xl font-bold" style={{ color: '#F0EAD6' }}>Clientes</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)',
            color: '#F0EAD6',
            boxShadow: '0 4px 15px rgba(201,168,76,0.2)'
          }}>
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Busca */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#3A3530' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empresa ou contato..."
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
          style={{
            background: '#1E1E1E',
            border: '1px solid #2A2A2A',
            color: '#F0EAD6',
          }}
          onFocus={e => e.target.style.borderColor = '#C9A84C'}
          onBlur={e => e.target.style.borderColor = '#2A2A2A'}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X size={14} style={{ color: '#7A7570' }} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
            <Users size={24} style={{ color: '#3A3530' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: '#7A7570' }}>Nenhum cliente encontrado</p>
          <p className="text-xs" style={{ color: '#3A3530' }}>Adicione seu primeiro cliente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => {
            const stage = STAGES[client.pipeline_stage] || STAGES.lead
            return (
              <button key={client.id} onClick={() => setSelected(client)}
                className="w-full rounded-2xl p-4 flex items-center justify-between transition-all active:scale-98 text-left"
                style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.15)' }}>
                    <span className="font-bold text-sm" style={{ color: '#C9A84C' }}>
                      {client.company_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: '#F0EAD6' }}>{client.company_name}</p>
                    <p className="text-xs mb-1.5" style={{ color: '#7A7570' }}>{client.contact_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: stage.bg, color: stage.color }}>
                      {stage.label}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: '#3A3530' }} />
              </button>
            )
          })}
        </div>
      )}

      {showForm && (
        <ClienteForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchClients() }} />
      )}
    </div>
  )
}
