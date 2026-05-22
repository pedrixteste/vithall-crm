import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Phone, MapPin, Edit2, Plus, Trash2, Calendar, AtSign, Minus, TrendingUp, Flag, UserCheck } from 'lucide-react'
import ClienteForm from './ClienteForm'
import TarefaForm from './TarefaForm'

const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAPE', 'Academia Vithall']

const STAGES = {
  nao_marcou:     { label: 'Nao marcou ainda', color: '#6B6560', bg: 'rgba(107,101,96,0.12)' },
  nao_visitado:   { label: 'Nao foi visitado', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  nao_apareceu:   { label: 'Nao apareceu',     color: '#E8834A', bg: 'rgba(232,131,74,0.12)' },
  recebeu_visita: { label: 'Recebeu visita',   color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  matriculado:    { label: 'Matriculado!!',    color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
}

const ORIGIN_LABELS = {
  'ligacao fria': { label: 'Ligacao fria', color: '#60A5FA' },
  'lead':         { label: 'Lead',         color: '#C9A84C' },
  'feiras':       { label: 'Feira',        color: '#A78BFA' },
  'indicacao':    { label: 'Indicacao',    color: '#4ADE80' },
}

export default function ClienteDetalhe({ client, onBack }) {
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [tab, setTab] = useState('visitas')
  const [showEdit, setShowEdit] = useState(false)
  const [showTarefaForm, setShowTarefaForm] = useState(false)
  const [currentClient, setCurrentClient] = useState(client)
  const [addingVisit, setAddingVisit] = useState(false)
  const [editingVisitId, setEditingVisitId] = useState(null)
  const [editingStage, setEditingStage] = useState(false)
  const [assignedName, setAssignedName] = useState(null)

  useEffect(() => { fetchVisits(); fetchTasks(); fetchAssigned() }, [])

  async function fetchAssigned() {
    if (!client.assigned_to) return
    const { data } = await supabase.from('profiles').select('name').eq('id', client.assigned_to).single()
    if (data) setAssignedName(data.name || 'Vendedor')
  }

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

  async function deleteTask(id) {
    if (!confirm('Excluir esta tarefa?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  async function addVisit() {
    setAddingVisit(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('visits').insert({ client_id: client.id, visit_date: today })
    await fetchVisits()
    setAddingVisit(false)
  }

  async function removeLastVisit() {
    if (visits.length === 0) return
    if (!confirm('Remover a visita mais recente?')) return
    await supabase.from('visits').delete().eq('id', visits[0].id)
    fetchVisits()
  }

  async function deleteVisit(id) {
    if (!confirm('Excluir esta visita?')) return
    await supabase.from('visits').delete().eq('id', id)
    fetchVisits()
  }

  async function updateStage(newStage) {
    await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', client.id)
    setCurrentClient(c => ({ ...c, matricula_stage: newStage }))
    setEditingStage(false)
  }

  async function updateVisitDate(visitId, newDate) {
    if (!newDate) return
    await supabase.from('visits').update({ visit_date: newDate }).eq('id', visitId)
    setEditingVisitId(null)
    fetchVisits()
  }

  async function toggleMatricula(training) {
    const current = currentClient.matriculas || []
    const updated = current.includes(training)
      ? current.filter(t => t !== training)
      : [...current, training]
    await supabase.from('clients').update({ matriculas: updated }).eq('id', client.id)
    setCurrentClient(c => ({ ...c, matriculas: updated }))
  }

  const stage = STAGES[currentClient.matricula_stage] || STAGES.nao_marcou
  const origin = ORIGIN_LABELS[currentClient.origin]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl transition-all"
          style={{ background: '#161616', border: '1px solid #303030', color: '#6B6560' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold flex-1 truncate" style={{ color: '#EFEFEF' }}>
          {currentClient.contact_name || currentClient.company_name}
        </h1>
        <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl"
          style={{ background: '#161616', border: '1px solid #303030', color: '#C9A84C' }}>
          <Edit2 size={16} />
        </button>
      </div>

      {/* Card de info principal */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #303030' }}>

        {/* Topo do card */}
        <div style={{ padding: '20px 20px 16px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(123,28,58,0.3), rgba(201,168,76,0.3))', border: '1px solid rgba(201,168,76,0.2)' }}>
                <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>
                  {(currentClient.contact_name || currentClient.company_name)?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-bold" style={{ color: '#EFEFEF' }}>{currentClient.contact_name || '—'}</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B6560' }}>
                  {[currentClient.contact_role, currentClient.company_name].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: stage.bg, color: stage.color }}>
              {stage.label}
            </span>
          </div>

          {/* Infos de contato */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentClient.phone && (
              <a href={`tel:${currentClient.phone}`} className="flex items-center gap-2.5 text-sm"
                style={{ color: '#6B6560' }}>
                <Phone size={14} style={{ color: '#C9A84C' }} />
                {currentClient.phone}
              </a>
            )}
            {currentClient.city && (
              <div className="flex items-center gap-2.5 text-sm" style={{ color: '#6B6560' }}>
                <MapPin size={14} style={{ color: '#C9A84C' }} />
                {currentClient.city}
              </div>
            )}
            {currentClient.instagram && (
              <a href={`https://instagram.com/${currentClient.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm" style={{ color: '#6B6560' }}>
                <AtSign size={14} style={{ color: '#C9A84C' }} />
                {currentClient.instagram}
              </a>
            )}
            {origin && (
              <div className="flex items-center gap-2.5 text-sm">
                <TrendingUp size={14} style={{ color: '#C9A84C' }} />
                <span style={{ color: '#6B6560' }}>Origem: </span>
                <span className="text-xs font-semibold rounded-full"
                  style={{ padding: '4px 12px', background: `${origin.color}18`, color: origin.color, border: `1px solid ${origin.color}30` }}>
                  {origin.label}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex items-center gap-2.5 text-sm">
                <Flag size={14} style={{ color: '#C9A84C' }} />
                <span style={{ color: '#6B6560' }}>Estagio: </span>
                <button onClick={() => setEditingStage(e => !e)}
                  className="text-xs font-semibold rounded-full transition-all"
                  style={{ padding: '4px 12px', background: stage.bg, color: stage.color, border: `1px solid ${stage.color}40`, cursor: 'pointer' }}>
                  {stage.label} ▾
                </button>
              </div>
              {editingStage && (
                <div className="flex flex-wrap" style={{ gap: '6px', paddingLeft: '22px' }}>
                  {Object.entries(STAGES).map(([key, s]) => (
                    <button key={key} onClick={() => updateStage(key)}
                      className="text-xs font-semibold rounded-full transition-all"
                      style={{
                        padding: '5px 12px',
                        background: currentClient.matricula_stage === key ? s.bg : 'transparent',
                        color: s.color,
                        border: `1px solid ${s.color}${currentClient.matricula_stage === key ? '50' : '25'}`,
                        cursor: 'pointer',
                      }}>
                      {currentClient.matricula_stage === key ? '✓ ' : ''}{s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {currentClient.matricula_stage === 'matriculado' && (
              <div style={{ paddingLeft: '22px' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
                  Treinamentos matriculados
                </p>
                <div className="flex flex-wrap" style={{ gap: '6px' }}>
                  {TRAININGS.map(t => {
                    const selected = (currentClient.matriculas || []).includes(t)
                    return (
                      <button key={t} onClick={() => toggleMatricula(t)}
                        className="text-xs font-semibold rounded-full transition-all"
                        style={{
                          padding: '5px 12px',
                          background: selected ? 'rgba(74,222,128,0.12)' : 'transparent',
                          color: selected ? '#4ADE80' : '#6B6560',
                          border: `1px solid ${selected ? 'rgba(74,222,128,0.4)' : '#2A2A2A'}`,
                          cursor: 'pointer',
                        }}>
                        {selected ? '✓ ' : ''}{t}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <UserCheck size={14} style={{ color: '#C9A84C' }} />
              <span style={{ color: '#6B6560' }}>Vendedor: </span>
              {currentClient.assigned_to ? (
                <span className="text-xs font-semibold rounded-full"
                  style={{ padding: '4px 12px', background: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  {assignedName || '...'}
                </span>
              ) : (
                <span className="text-xs font-semibold" style={{ color: '#E8834A' }}>
                  ⚠️ Nao atribuido
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contador de visitas */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #222' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#333030' }}>
                Visitas realizadas
              </p>
              <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: '#EFEFEF', letterSpacing: '-1px' }}>
                {visits.length}
                <span className="text-sm font-normal ml-2" style={{ color: '#6B6560' }}>
                  {visits.length === 1 ? 'visita' : 'visitas'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={removeLastVisit}
                disabled={visits.length === 0}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: '#111', border: '1px solid #2A2A2A', color: visits.length === 0 ? '#252525' : '#6B6560' }}>
                <Minus size={16} />
              </button>
              <button
                onClick={addVisit}
                disabled={addingVisit}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', boxShadow: '0 2px 12px rgba(201,168,76,0.25)' }}>
                <Plus size={18} color="#F0EAD6" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-xl gap-1" style={{ background: '#161616', border: '1px solid #303030' }}>
        {['visitas', 'tarefas'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'rgba(201,168,76,0.12)' : 'transparent',
              color: tab === t ? '#C9A84C' : '#6B6560',
              border: tab === t ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {t === 'visitas' ? `Visitas (${visits.length})` : `Tarefas (${tasks.length})`}
          </button>
        ))}
      </div>

      {/* Visitas */}
      {tab === 'visitas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visits.length === 0 ? (
            <div className="text-center rounded-2xl" style={{ padding: '48px 0', background: '#161616', border: '1px dashed #303030' }}>
              <Calendar size={24} className="mx-auto mb-3" style={{ color: '#252525' }} />
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma visita registrada</p>
              <p className="text-xs mt-1" style={{ color: '#252525' }}>Toque em + para registrar a primeira</p>
            </div>
          ) : (
            visits.map((v, i) => (
              <div key={v.id} className="rounded-2xl" style={{ background: '#161616', border: '1px solid #303030', padding: '16px 18px' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                      {visits.length - i}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>
                        {i === 0 ? 'Visita mais recente' : `${visits.length - i}a visita`}
                      </p>
                      {editingVisitId === v.id ? (
                        <input
                          type="date"
                          defaultValue={v.visit_date}
                          autoFocus
                          onChange={e => updateVisitDate(v.id, e.target.value)}
                          onBlur={() => setEditingVisitId(null)}
                          style={{ marginTop: '4px', background: '#111', border: '1px solid #C9A84C', color: '#EFEFEF', borderRadius: '8px', padding: '3px 8px', fontSize: '12px', outline: 'none' }}
                        />
                      ) : (
                        <p className="text-xs mt-0.5" onClick={() => setEditingVisitId(v.id)}
                          style={{ color: '#6B6560', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                          {new Date(v.visit_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteVisit(v.id)}>
                    <Trash2 size={14} style={{ color: '#2A2A2A' }} />
                  </button>
                </div>
                {(v.outcome || v.next_step || v.notes) && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #222' }}>
                    {v.outcome && <p className="text-xs" style={{ color: '#6B6560' }}><span style={{ color: '#EFEFEF' }}>Resultado:</span> {v.outcome}</p>}
                    {v.next_step && <p className="text-xs mt-1" style={{ color: '#6B6560' }}><span style={{ color: '#EFEFEF' }}>Próximo passo:</span> {v.next_step}</p>}
                    {v.notes && <p className="text-xs italic mt-1" style={{ color: '#333030' }}>"{v.notes}"</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tarefas */}
      {tab === 'tarefas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#333030' }}>Follow-ups</p>
            <button onClick={() => setShowTarefaForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: '#C9A84C' }}>
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center rounded-2xl" style={{ padding: '48px 0', background: '#161616', border: '1px dashed #303030' }}>
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma tarefa registrada</p>
            </div>
          ) : (
            tasks.map(t => (
              <div key={t.id} className="rounded-2xl flex items-center gap-3"
                style={{ background: '#161616', border: '1px solid #303030', padding: '14px 16px', opacity: t.completed ? 0.5 : 1 }}>
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
                    color: t.completed ? '#3A3530' : '#EFEFEF',
                    textDecoration: t.completed ? 'line-through' : 'none'
                  }}>{t.title}</p>
                  {t.due_date && (
                    <p className="text-xs mt-0.5" style={{ color: '#E8834A' }}>
                      {new Date(t.due_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteTask(t.id)}>
                  <Trash2 size={14} style={{ color: '#2A2A2A' }} />
                </button>
              </div>
            ))
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
      {showTarefaForm && (
        <TarefaForm clientId={client.id} onClose={() => setShowTarefaForm(false)}
          onSaved={() => { setShowTarefaForm(false); fetchTasks() }} />
      )}
    </div>
  )
}
