import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Phone, Mail, MapPin, Edit2, Plus, Trash2, Calendar } from 'lucide-react'
import ClienteForm from './ClienteForm'
import VisitaForm from './VisitaForm'
import TarefaForm from './TarefaForm'

const STAGES = {
  lead: { label: 'Lead', color: '#7A7570', bg: 'rgba(122,117,112,0.12)' },
  negociacao: { label: 'Em negociação', color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  proposta: { label: 'Proposta', color: '#9B5DE5', bg: 'rgba(155,93,229,0.12)' },
  fechado: { label: 'Fechado', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
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
    const { data } = await supabase.from('visits').select('*').eq('client_id', client.id).order('visit_date', { ascending: false })
    setVisits(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('client_id', client.id).order('due_date')
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

  const stage = STAGES[currentClient.pipeline_stage] || STAGES.lead

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-2 rounded-xl transition-all"
          style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', color: '#7A7570' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold flex-1 truncate" style={{ color: '#F0EAD6' }}>
          {currentClient.company_name}
        </h1>
        <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl"
          style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', color: '#C9A84C' }}>
          <Edit2 size={16} />
        </button>
      </div>

      {/* Card de info */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(123,28,58,0.3), rgba(201,168,76,0.3))', border: '1px solid rgba(201,168,76,0.2)' }}>
              <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>
                {currentClient.company_name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold" style={{ color: '#F0EAD6' }}>{currentClient.contact_name || '—'}</p>
              <p className="text-xs mt-0.5" style={{ color: '#7A7570' }}>{currentClient.contact_role}</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: stage.bg, color: stage.color }}>
            {stage.label}
          </span>
        </div>

        <div className="space-y-2.5">
          {currentClient.phone && (
            <a href={`tel:${currentClient.phone}`} className="flex items-center gap-2.5 text-sm transition-all"
              style={{ color: '#7A7570' }}>
              <Phone size={14} style={{ color: '#C9A84C' }} />
              {currentClient.phone}
            </a>
          )}
          {currentClient.email && (
            <a href={`mailto:${currentClient.email}`} className="flex items-center gap-2.5 text-sm"
              style={{ color: '#7A7570' }}>
              <Mail size={14} style={{ color: '#C9A84C' }} />
              {currentClient.email}
            </a>
          )}
          {currentClient.address && (
            <div className="flex items-center gap-2.5 text-sm" style={{ color: '#7A7570' }}>
              <MapPin size={14} style={{ color: '#C9A84C' }} />
              {currentClient.address}
            </div>
          )}
        </div>

        {currentClient.notes && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: '#2A2A2A' }}>
            <p className="text-xs italic" style={{ color: '#7A7570' }}>"{currentClient.notes}"</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-xl mb-4 gap-1" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
        {['visitas', 'tarefas'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: tab === t ? '#C9A84C' : '#7A7570',
              border: tab === t ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {t === 'visitas' ? `Visitas (${visits.length})` : `Tarefas (${tasks.length})`}
          </button>
        ))}
      </div>

      {/* Visitas */}
      {tab === 'visitas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3A3530' }}>Histórico</p>
            <button onClick={() => setShowVisitaForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: '#C9A84C' }}>
              <Plus size={15} /> Nova visita
            </button>
          </div>
          {visits.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#1E1E1E', border: '1px dashed #2A2A2A' }}>
              <Calendar size={24} className="mx-auto mb-2" style={{ color: '#2A2A2A' }} />
              <p className="text-sm" style={{ color: '#3A3530' }}>Nenhuma visita registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map(v => (
                <div key={v.id} className="rounded-2xl p-4" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#C9A84C' }} />
                      <p className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>
                        {new Date(v.visit_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <button onClick={() => deleteVisit(v.id)}>
                      <Trash2 size={14} style={{ color: '#3A3530' }} />
                    </button>
                  </div>
                  {v.examples_shown?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: '#3A3530' }}>Exemplos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {v.examples_shown.map((ex, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {v.outcome && (
                    <p className="text-xs mb-1" style={{ color: '#7A7570' }}>
                      <span style={{ color: '#F0EAD6' }}>Resultado:</span> {v.outcome}
                    </p>
                  )}
                  {v.next_step && (
                    <p className="text-xs mb-1" style={{ color: '#7A7570' }}>
                      <span style={{ color: '#F0EAD6' }}>Próximo passo:</span> {v.next_step}
                    </p>
                  )}
                  {v.notes && (
                    <p className="text-xs italic mt-2" style={{ color: '#3A3530' }}>"{v.notes}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tarefas */}
      {tab === 'tarefas' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3A3530' }}>Follow-ups</p>
            <button onClick={() => setShowTarefaForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: '#C9A84C' }}>
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#1E1E1E', border: '1px dashed #2A2A2A' }}>
              <p className="text-sm" style={{ color: '#3A3530' }}>Nenhuma tarefa registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', opacity: t.completed ? 0.5 : 1 }}>
                  <button onClick={() => toggleTask(t)}
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                    style={{
                      borderColor: t.completed ? '#4ADE80' : '#2A2A2A',
                      background: t.completed ? 'rgba(74,222,128,0.15)' : 'transparent',
                    }}>
                    {t.completed && <span style={{ color: '#4ADE80', fontSize: '11px' }}>✓</span>}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{
                      color: t.completed ? '#3A3530' : '#F0EAD6',
                      textDecoration: t.completed ? 'line-through' : 'none'
                    }}>{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs mt-0.5" style={{ color: '#E8834A' }}>
                        {new Date(t.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteTask(t.id)}>
                    <Trash2 size={14} style={{ color: '#3A3530' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <ClienteForm initialData={currentClient} onClose={() => setShowEdit(false)}
          onSaved={async () => {
            const { data } = await supabase.from('clients').select('*').eq('id', client.id).single()
            setCurrentClient(data)
            setShowEdit(false)
          }} />
      )}
      {showVisitaForm && (
        <VisitaForm clientId={client.id} onClose={() => setShowVisitaForm(false)}
          onSaved={() => { setShowVisitaForm(false); fetchVisits() }} />
      )}
      {showTarefaForm && (
        <TarefaForm clientId={client.id} onClose={() => setShowTarefaForm(false)}
          onSaved={() => { setShowTarefaForm(false); fetchTasks() }} />
      )}
    </div>
  )
}
