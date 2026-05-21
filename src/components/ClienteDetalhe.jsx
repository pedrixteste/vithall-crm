import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Phone, Mail, MapPin, Edit2, Plus, Trash2 } from 'lucide-react'
import ClienteForm from './ClienteForm'
import VisitaForm from './VisitaForm'
import TarefaForm from './TarefaForm'

const STAGES = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-600' },
  negociacao: { label: 'Em negociação', color: 'bg-blue-100 text-blue-600' },
  proposta: { label: 'Proposta enviada', color: 'bg-yellow-100 text-yellow-700' },
  fechado: { label: 'Fechado', color: 'bg-green-100 text-green-700' },
}

export default function ClienteDetalhe({ client, onBack }) {
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [tab, setTab] = useState('visitas')
  const [showEdit, setShowEdit] = useState(false)
  const [showVisitaForm, setShowVisitaForm] = useState(false)
  const [showTarefaForm, setShowTarefaForm] = useState(false)
  const [currentClient, setCurrentClient] = useState(client)

  useEffect(() => { fetchVisits(); fetchTasks() }, [])

  async function fetchVisits() {
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', client.id)
      .order('visit_date', { ascending: false })
    setVisits(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', client.id)
      .order('due_date')
    setTasks(data || [])
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  async function deleteVisit(id) {
    if (!confirm('Excluir esta visita?')) return
    await supabase.from('visits').delete().eq('id', id)
    fetchVisits()
  }

  async function deleteTask(id) {
    if (!confirm('Excluir esta tarefa?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  return (
    <div className="pb-20 sm:pb-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1 truncate">{currentClient.company_name}</h1>
        <button onClick={() => setShowEdit(true)} className="text-blue-600 hover:text-blue-700">
          <Edit2 size={18} />
        </button>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-gray-800">{currentClient.contact_name}</p>
            <p className="text-xs text-gray-400">{currentClient.contact_role}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGES[currentClient.pipeline_stage]?.color}`}>
            {STAGES[currentClient.pipeline_stage]?.label}
          </span>
        </div>

        <div className="space-y-2">
          {currentClient.phone && (
            <a href={`tel:${currentClient.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
              <Phone size={14} className="text-gray-400" /> {currentClient.phone}
            </a>
          )}
          {currentClient.email && (
            <a href={`mailto:${currentClient.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
              <Mail size={14} className="text-gray-400" /> {currentClient.email}
            </a>
          )}
          {currentClient.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400" /> {currentClient.address}
            </div>
          )}
          {currentClient.notes && (
            <p className="text-sm text-gray-500 mt-2 italic">"{currentClient.notes}"</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
        <button
          onClick={() => setTab('visitas')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${tab === 'visitas' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          Visitas ({visits.length})
        </button>
        <button
          onClick={() => setTab('tarefas')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${tab === 'tarefas' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          Tarefas ({tasks.length})
        </button>
      </div>

      {tab === 'visitas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-gray-700">Histórico de visitas</p>
            <button onClick={() => setShowVisitaForm(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus size={16} /> Nova visita
            </button>
          </div>
          {visits.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Nenhuma visita registrada</p>
          ) : (
            <div className="space-y-2">
              {visits.map(v => (
                <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm text-gray-800">
                      {new Date(v.visit_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <button onClick={() => deleteVisit(v.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {v.examples_shown?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Exemplos apresentados:</p>
                      <div className="flex flex-wrap gap-1">
                        {v.examples_shown.map((ex, i) => (
                          <span key={i} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">{ex}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {v.outcome && <p className="text-xs text-gray-600"><span className="font-medium">Resultado:</span> {v.outcome}</p>}
                  {v.next_step && <p className="text-xs text-gray-600"><span className="font-medium">Próximo passo:</span> {v.next_step}</p>}
                  {v.notes && <p className="text-xs text-gray-500 italic mt-1">"{v.notes}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tarefas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-gray-700">Tarefas de follow-up</p>
            <button onClick={() => setShowTarefaForm(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus size={16} /> Nova tarefa
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Nenhuma tarefa registrada</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
                  <button onClick={() => toggleTask(t)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                      ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {t.completed && <span className="text-white text-xs">✓</span>}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${t.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</p>
                    {t.due_date && <p className="text-xs text-orange-500">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>}
                    {t.notes && <p className="text-xs text-gray-400">{t.notes}</p>}
                  </div>
                  <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <ClienteForm
          initialData={currentClient}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            const { data } = await supabase.from('clients').select('*').eq('id', client.id).single()
            setCurrentClient(data)
            setShowEdit(false)
          }}
        />
      )}

      {showVisitaForm && (
        <VisitaForm
          clientId={client.id}
          onClose={() => setShowVisitaForm(false)}
          onSaved={() => { setShowVisitaForm(false); fetchVisits() }}
        />
      )}

      {showTarefaForm && (
        <TarefaForm
          clientId={client.id}
          onClose={() => setShowTarefaForm(false)}
          onSaved={() => { setShowTarefaForm(false); fetchTasks() }}
        />
      )}
    </div>
  )
}
