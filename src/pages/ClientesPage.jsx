import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, X, MapPin } from 'lucide-react'
import ClienteForm from '../components/ClienteForm'
import ClienteDetalhe from '../components/ClienteDetalhe'

const STAGES = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-600' },
  negociacao: { label: 'Em negociação', color: 'bg-blue-100 text-blue-600' },
  proposta: { label: 'Proposta enviada', color: 'bg-yellow-100 text-yellow-700' },
  fechado: { label: 'Fechado', color: 'bg-green-100 text-green-700' },
}

export default function ClientesPage() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('company_name')
    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) return (
    <ClienteDetalhe
      client={selected}
      onBack={() => { setSelected(null); fetchClients() }}
    />
  )

  return (
    <div className="pb-20 sm:pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1 hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por empresa ou contato..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MapPin size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <button
              key={client.id}
              onClick={() => setSelected(client)}
              className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition text-left"
            >
              <div>
                <p className="font-semibold text-gray-800 text-sm">{client.company_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{client.contact_name}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${STAGES[client.pipeline_stage]?.color}`}>
                  {STAGES[client.pipeline_stage]?.label}
                </span>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <ClienteForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchClients() }}
        />
      )}
    </div>
  )
}
