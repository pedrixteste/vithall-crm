import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Phone, MapPin, Edit2, Plus, Trash2, Calendar, AtSign, Minus, TrendingUp, Flag, UserCheck, Clock, X, Star } from 'lucide-react'
import { getValidToken, createCalendarEvent, deleteCalendarEvent } from '../lib/googleCalendar'
import ClienteForm from './ClienteForm'
import TarefaForm from './TarefaForm'

const TRAININGS          = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Workshop', 'Palestra']
const TRAININGS_INTERESSE = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Workshop', 'Palestra']

const STAGES = {
  nao_marcou:     { label: 'Nao marcou ainda', color: '#6B6560', bg: 'rgba(107,101,96,0.12)' },
  pediu_ligar:    { label: 'Pediu para ligar', color: '#E8834A', bg: 'rgba(232,131,74,0.12)'  },
  nao_visitado:   { label: 'Nao foi visitado', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
  nao_apareceu:   { label: 'Nao apareceu',     color: '#E85555', bg: 'rgba(232,85,85,0.12)'   },
  cancelado:      { label: 'Cancelou visita',  color: '#F97316', bg: 'rgba(249,115,22,0.12)'  },
  recebeu_visita: { label: 'Recebeu visita',   color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  matriculado:    { label: 'Matriculado!!',    color: '#4ADE80', bg: 'rgba(74,222,128,0.12)'  },
}

const ORIGIN_LABELS = {
  'frias contatinhos': { label: 'Frias contatinhos', color: '#60A5FA' },
  'frias listas':      { label: 'Frias listas',      color: '#38BDF8' },
  'lead':              { label: 'Lead',               color: '#C9A84C' },
  'feiras':            { label: 'Feira',              color: '#A78BFA' },
  'indicacao':         { label: 'Indicacao',          color: '#4ADE80' },
}

const DAYS_PT = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }

const RATINGS = [
  { key: 'pessima',  label: 'Péssima',  color: '#E85555', bg: 'rgba(232,85,85,0.13)'   },
  { key: 'razoavel', label: 'Razoável', color: '#E8834A', bg: 'rgba(232,131,74,0.13)'  },
  { key: 'boa',      label: 'Boa',      color: '#60A5FA', bg: 'rgba(96,165,250,0.13)'  },
  { key: 'otima',    label: 'Ótima',    color: '#4ADE80', bg: 'rgba(74,222,128,0.13)'  },
]

// ── Helpers de histórico ───────────────────────────────────────────

function formatTimeAgo(dateStr) {
  const now  = new Date()
  const date = new Date(dateStr)
  const ms   = now - date
  const mins = Math.floor(ms / 60000)
  const hrs  = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 2)  return 'agora'
  if (mins < 60) return `ha ${mins}min`
  if (hrs  < 24) return `ha ${hrs}h`
  if (days === 1) return 'ontem'
  if (days < 7)  return `ha ${days} dias`
  if (days < 30) return `ha ${Math.floor(days / 7)} sem.`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function describeEvent(type, data) {
  if (type === 'created')           return 'Cliente cadastrado no sistema'
  if (type === 'visit')             return 'Visita registrada'
  if (type === 'matricula_added')   return `Matriculado em ${data?.training}`
  if (type === 'matricula_removed') return `Matricula removida: ${data?.training}`
  if (type === 'stage_change') {
    return STAGES[data?.to]?.label || data?.to || '—'
  }
  return type
}

function getEventColor(type, data) {
  if (type === 'stage_change') {
    const map = {
      matriculado: '#4ADE80', nao_apareceu: '#E85555', cancelado: '#F97316',
      recebeu_visita: '#A78BFA', nao_visitado: '#60A5FA',
      pediu_ligar: '#E8834A', nao_marcou: '#6B6560',
    }
    return map[data?.to] || '#6B6560'
  }
  if (type === 'matricula_added')   return '#4ADE80'
  if (type === 'matricula_removed') return '#E85555'
  if (type === 'visit')             return '#A78BFA'
  if (type === 'created')           return '#C9A84C'
  return '#6B6560'
}

function getEventIcon(type, data) {
  if (type === 'created')           return '👤'
  if (type === 'visit')             return '📍'
  if (type === 'matricula_added')   return '✅'
  if (type === 'matricula_removed') return '❌'
  if (type === 'stage_change') {
    if (data?.to === 'nao_apareceu')   return '🚫'
    if (data?.to === 'cancelado')      return '📵'
    if (data?.to === 'matriculado')    return '🎉'
    if (data?.to === 'recebeu_visita') return '🤝'
    if (data?.to === 'nao_visitado')   return '📅'
    if (data?.to === 'pediu_ligar')    return '📞'
    return '🔄'
  }
  return '•'
}

function formatReminder(rc) {
  if (!rc) return null
  let typeStr = ''
  if (rc.type === 'daily')   typeStr = 'Todo dia'
  if (rc.type === 'weekly')  typeStr = `Toda semana (${(rc.days || []).map(d => DAYS_PT[d]).join(', ')})`
  if (rc.type === 'in_days') typeStr = `Daqui ${rc.in_days} dia${rc.in_days !== 1 ? 's' : ''}`
  const times = (rc.times || []).join(' · ')
  return times ? `${typeStr} às ${times}` : typeStr
}

// ── Componente de evento na timeline ──────────────────────────────

function TimelineEvent({ event, isLast, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(null)

  const isDerived   = !!event._derived
  const color       = getEventColor(event.event_type, event.event_data)
  const icon        = getEventIcon(event.event_type, event.event_data)
  const isAlert     = event.event_type === 'stage_change' && event.event_data?.to === 'nao_apareceu'
  const isCelebr    = event.event_type === 'stage_change' && event.event_data?.to === 'matriculado'
  const isHighlight = isAlert || isCelebr

  function startEdit() {
    if (event.event_type === 'visit') setEditValue(event.event_data?.date || '')
    else if (event.event_type === 'stage_change') setEditValue(event.event_data?.to || '')
    else if (event.event_type === 'matricula_added' || event.event_type === 'matricula_removed') setEditValue(event.event_data?.training || '')
    setIsEditing(true)
  }

  function cancelEdit() { setIsEditing(false); setEditValue(null) }

  function submitEdit() {
    if (!editValue) { cancelEdit(); return }
    const newData = { ...event.event_data }
    if (event.event_type === 'visit') newData.date = editValue
    else if (event.event_type === 'stage_change') newData.to = editValue
    else if (event.event_type === 'matricula_added' || event.event_type === 'matricula_removed') newData.training = editValue
    onEdit(event.id, newData)
    setIsEditing(false)
  }

  return (
    <div style={{ display: 'flex', gap: '14px' }}>
      {/* Linha vertical + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: `${color}18`, border: `1.5px solid ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px',
        }}>
          {icon}
        </div>
        {!isLast && (
          <div style={{ width: '1.5px', flex: 1, minHeight: '16px', background: '#1E1E1E', margin: '4px 0' }} />
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '16px' }}>
        <div style={{
          padding: '12px 14px', borderRadius: '14px',
          background: isHighlight ? `${color}0D` : '#111',
          border: `1px solid ${isHighlight ? color + '30' : '#1C1C1C'}`,
        }}>
          {/* Linha principal: texto + botões */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: isHighlight ? color : '#EFEFEF', lineHeight: 1.3 }}>
                {describeEvent(event.event_type, event.event_data)}
              </p>
              {event.event_type === 'stage_change' && event.event_data?.from && (
                <p style={{ fontSize: '11px', color: '#3A3A3A', marginTop: '3px' }}>
                  anterior: {STAGES[event.event_data.from]?.label || event.event_data.from}
                </p>
              )}
              {event.user_name && (
                <p style={{ fontSize: '11px', color: '#3A3A3A', marginTop: '3px' }}>
                  por {event.user_name}
                </p>
              )}
            </div>
            {/* Botões editar/apagar — apenas para eventos reais (não derivados) */}
            {!isDerived && !isEditing && (
              <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                <button onClick={startEdit} style={{
                  width: '26px', height: '26px', borderRadius: '7px',
                  background: '#1A1A1A', border: '1px solid #2A2A2A',
                  color: '#4A4A4A', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Edit2 size={11} />
                </button>
                <button onClick={() => onDelete(event.id)} style={{
                  width: '26px', height: '26px', borderRadius: '7px',
                  background: '#1A1A1A', border: '1px solid #2A2A2A',
                  color: '#4A4A4A', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Editor inline */}
          {isEditing && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #1C1C1C' }}>
              {event.event_type === 'visit' && (
                <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)}
                  style={{ width: '100%', background: '#0E0E0E', border: '1px solid #C9A84C40', color: '#EFEFEF', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }}
                />
              )}
              {event.event_type === 'stage_change' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {Object.entries(STAGES).map(([key, s]) => (
                    <button key={key} onClick={() => setEditValue(key)} style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      background: editValue === key ? s.bg : 'transparent',
                      color: s.color,
                      border: `1px solid ${s.color}${editValue === key ? '50' : '20'}`,
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {(event.event_type === 'matricula_added' || event.event_type === 'matricula_removed') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {TRAININGS.map(t => (
                    <button key={t} onClick={() => setEditValue(t)} style={{
                      padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      background: editValue === t ? 'rgba(74,222,128,0.12)' : 'transparent',
                      color: editValue === t ? '#4ADE80' : '#6B6560',
                      border: `1px solid ${editValue === t ? 'rgba(74,222,128,0.4)' : '#2A2A2A'}`,
                    }}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={submitEdit} style={{
                  flex: 1, padding: '6px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(74,222,128,0.12)', color: '#4ADE80',
                  border: '1px solid rgba(74,222,128,0.3)', cursor: 'pointer',
                }}>Salvar</button>
                <button onClick={cancelEdit} style={{
                  flex: 1, padding: '6px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  background: '#1A1A1A', color: '#6B6560',
                  border: '1px solid #2A2A2A', cursor: 'pointer',
                }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
        <p style={{ fontSize: '10px', color: '#2A2A2A', marginTop: '5px', marginLeft: '2px' }}>
          {formatTimeAgo(event.created_at)}
          {' · '}
          {new Date(event.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          {' às '}
          {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────

export default function ClienteDetalhe({ client, onBack, onClose, onUpdated }) {
  const { user, profile: authProfile } = useAuth()
  const goBack = onBack || onClose || (() => {})

  // Perfil fresco do banco (inclui tokens do Google mesmo conectados depois do login)
  const [freshProfile, setFreshProfile] = useState(authProfile)
  const profile = freshProfile  // usa perfil fresco em todo o componente

  const [visits, setVisits]               = useState([])
  const [tasks, setTasks]                 = useState([])
  const [history, setHistory]             = useState([])
  const [tab, setTab]                     = useState('visitas')
  const [showEdit, setShowEdit]           = useState(false)
  const [showHistory, setShowHistory]     = useState(false)
  const [showTarefaForm, setShowTarefaForm] = useState(false)
  const [currentClient, setCurrentClient] = useState(client)
  const [addingVisit, setAddingVisit]     = useState(false)
  const [editingVisitId, setEditingVisitId] = useState(null)
  const [editingStage, setEditingStage]   = useState(false)
  const [pendingStage, setPendingStage]   = useState(null)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [assignedName, setAssignedName]   = useState(null)
  const [notesValue, setNotesValue]       = useState(client.notes || '')
  const [savingNotes, setSavingNotes]     = useState(false)
  const [notesSaved, setNotesSaved]       = useState(false)
  const [showRating, setShowRating]       = useState(false)
  const [ratingEdits, setRatingEdits]     = useState({}) // { [visitId]: { rating, visit_notes } }
  const [savingRatingId, setSavingRatingId] = useState(null)

  useEffect(() => {
    fetchVisits(); fetchTasks(); fetchAssigned(); fetchHistory()
    // Busca perfil fresco para garantir tokens do Google atualizados
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setFreshProfile(data) })
  }, [])

  // ── Fetches ────────────────────────────────────────────────────

  async function fetchAssigned() {
    if (!client.assigned_to) return
    const { data } = await supabase.from('profiles').select('name').eq('id', client.assigned_to).single()
    if (data) setAssignedName(data.name || 'Vendedor')
  }

  async function fetchVisits() {
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', client.id)
      .order('visit_date', { ascending: false })
    let fetched = data || []

    // Após a data da visita agendada passar, criar o registro automaticamente
    if (client.visit_scheduled_at) {
      const scheduledDate = new Date(client.visit_scheduled_at)
      if (scheduledDate < new Date()) {
        const dateStr = scheduledDate.toISOString().split('T')[0]
        const alreadyExists = fetched.some(v => v.visit_date === dateStr)
        if (!alreadyExists) {
          const { data: inserted } = await supabase
            .from('visits')
            .insert({ client_id: client.id, visit_date: dateStr })
            .select()
            .single()
          if (inserted) {
            fetched = [inserted, ...fetched]
            await logEvent('visit', { date: dateStr })
            fetchHistory()
          }
        }
      }
    }

    setVisits(fetched)
  }

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('client_id', client.id).order('due_date')
    setTasks(data || [])
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('client_history')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setHistory(data || [])
  }

  async function logEvent(event_type, event_data = {}) {
    await supabase.from('client_history').insert({
      client_id:  client.id,
      user_id:    user?.id,
      user_name:  profile?.name || null,
      event_type,
      event_data,
    })
  }

  // ── Actions ───────────────────────────────────────────────────

  async function saveNotes() {
    if (notesValue === currentClient.notes) return
    setSavingNotes(true)
    await supabase.from('clients').update({ notes: notesValue }).eq('id', client.id)
    setCurrentClient(c => ({ ...c, notes: notesValue }))
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
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
    await logEvent('visit', { date: today })
    await fetchVisits()
    if (showHistory) fetchHistory()
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
    const oldStage = currentClient.matricula_stage
    if (oldStage === newStage) { setEditingStage(false); return }
    await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', client.id)
    await logEvent('stage_change', { from: oldStage, to: newStage })
    setCurrentClient(c => ({ ...c, matricula_stage: newStage }))
    setEditingStage(false)
    fetchHistory()

    // Se cancelou → remove evento do Google Agenda automaticamente
    if (newStage === 'cancelado') {
      try {
        const [{ data: freshClient }, { data: freshProfile }] = await Promise.all([
          supabase.from('clients').select('google_calendar_event_id').eq('id', client.id).single(),
          supabase.from('profiles').select('*').eq('id', user.id).single(),
        ])
        const eventId = freshClient?.google_calendar_event_id
        if (!eventId) {
          // Nenhum evento registrado — nada a deletar
          return
        }
        const token = await getValidToken(freshProfile)
        if (!token) {
          alert('Visita cancelada! Mas não foi possível remover do Google Agenda (token inválido). Remova manualmente.')
          return
        }
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.status === 204 || res.status === 404) {
          await supabase.from('clients').update({ google_calendar_event_id: null }).eq('id', client.id)
          setCurrentClient(c => ({ ...c, google_calendar_event_id: null }))
        } else {
          const err = await res.json().catch(() => ({}))
          alert(`Visita cancelada! Mas não foi possível remover do Google Agenda (${res.status}: ${err?.error?.message || 'erro desconhecido'}). Remova manualmente.`)
        }
      } catch (e) {
        console.error('Erro ao remover evento do Google Agenda:', e)
      }
    }
  }

  async function syncCalendarEvent() {
    if (!currentClient.visit_scheduled_at) return
    setSyncingCalendar(true)
    try {
      // Busca perfil fresco para garantir tokens atualizados
      const { data: freshProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const token = await getValidToken(freshProfile)
      if (!token) { alert('Conecte o Google Agenda no seu Perfil primeiro.'); return }
      const eventId = await createCalendarEvent(token, {
        clientName:    currentClient.contact_name || currentClient.company_name || 'Cliente',
        visitDateTime: currentClient.visit_scheduled_at,
      })
      await supabase.from('clients').update({ google_calendar_event_id: eventId }).eq('id', client.id)
      setCurrentClient(c => ({ ...c, google_calendar_event_id: eventId }))
    } catch (e) {
      alert(`Erro ao sincronizar: ${e.message}`)
    } finally {
      setSyncingCalendar(false)
    }
  }

  async function updateVisitDate(visitId, newDate) {
    if (!newDate) return
    await supabase.from('visits').update({ visit_date: newDate }).eq('id', visitId)
    setEditingVisitId(null)
    fetchVisits()
  }

  async function toggleTreinamentoInteresse(training) {
    const current = currentClient.treinamentos_interesse || []
    const updated = current.includes(training)
      ? current.filter(t => t !== training)
      : [...current, training]
    await supabase.from('clients').update({ treinamentos_interesse: updated }).eq('id', client.id)
    setCurrentClient(c => ({ ...c, treinamentos_interesse: updated }))
  }

  async function toggleMatricula(training) {
    const current = currentClient.matriculas || []
    const isRemoving = current.includes(training)
    const updated = isRemoving ? current.filter(t => t !== training) : [...current, training]
    await supabase.from('clients').update({ matriculas: updated }).eq('id', client.id)
    await logEvent(isRemoving ? 'matricula_removed' : 'matricula_added', { training })
    setCurrentClient(c => ({ ...c, matriculas: updated }))
    fetchHistory()
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Remover este evento do histórico?')) return
    await supabase.from('client_history').delete().eq('id', id)
    fetchHistory()
  }

  async function handleEditEvent(id, newData) {
    await supabase.from('client_history').update({ event_data: newData }).eq('id', id)
    fetchHistory()
  }

  // ── Avaliação de visitas ───────────────────────────────────────────

  function openRatingPanel() {
    const initial = {}
    visits.forEach(v => {
      initial[v.id] = { rating: v.rating || null, visit_notes: v.visit_notes || '' }
    })
    setRatingEdits(initial)
    setShowRating(true)
  }

  async function saveVisitRating(visitId) {
    const edit = ratingEdits[visitId]
    if (!edit) return
    setSavingRatingId(visitId)
    await supabase.from('visits').update({
      rating:      edit.rating,
      visit_notes: edit.visit_notes,
    }).eq('id', visitId)
    setSavingRatingId(null)
    setVisits(prev => prev.map(v => v.id === visitId ? { ...v, ...edit } : v))
  }

  const canRate = user.id === currentClient.assigned_to || user.id === currentClient.created_by

  // ── Timeline montada (histórico + visitas derivadas + criação) ──

  const timelineItems = (() => {
    const items = [...history]

    // Adiciona visitas que não têm evento de histórico correspondente
    // (visitas existentes antes do sistema de histórico)
    visits.forEach(v => {
      const alreadyLogged = history.some(
        h => h.event_type === 'visit' && h.event_data?.date === v.visit_date
      )
      if (!alreadyLogged) {
        items.push({
          id: `visit-${v.id}`,
          _derived: true,
          event_type: 'visit',
          event_data: { date: v.visit_date },
          created_at: v.visit_date + 'T12:00:00',
          user_name: null,
        })
      }
    })

    // Evento de criação do cliente como âncora do histórico
    const hasCreated = history.some(h => h.event_type === 'created')
    if (!hasCreated) {
      items.push({
        id: 'created',
        _derived: true,
        event_type: 'created',
        event_data: {},
        created_at: currentClient.created_at,
        user_name: null,
      })
    }

    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  })()

  const noShowCount  = history.filter(
    h => h.event_type === 'stage_change' && h.event_data?.to === 'nao_apareceu'
  ).length

  const cancelCount  = history.filter(
    h => h.event_type === 'stage_change' && h.event_data?.to === 'cancelado'
  ).length

  const stage  = STAGES[currentClient.matricula_stage] || STAGES.nao_marcou
  const origin = ORIGIN_LABELS[currentClient.origin]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="p-2 rounded-xl transition-all"
          style={{ background: '#161616', border: '1px solid #303030', color: '#6B6560' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold flex-1 truncate" style={{ color: '#EFEFEF' }}>
          {currentClient.contact_name || currentClient.company_name}
        </h1>
        {/* Botão avaliação de visitas */}
        {visits.length > 0 && (
          <button onClick={openRatingPanel}
            className="p-2 rounded-xl relative"
            style={{
              background: visits.some(v => v.rating) ? 'rgba(201,168,76,0.08)' : '#161616',
              border: `1px solid ${visits.some(v => v.rating) ? 'rgba(201,168,76,0.3)' : '#303030'}`,
              color: visits.some(v => v.rating) ? '#C9A84C' : '#6B6560',
            }}>
            <Star size={16} fill={visits.some(v => v.rating) ? '#C9A84C' : 'none'} />
          </button>
        )}
        {/* Botão histórico */}
        <button onClick={() => { setShowHistory(true); fetchHistory() }}
          className="p-2 rounded-xl relative"
          style={{ background: '#161616', border: '1px solid #303030', color: '#6B6560' }}>
          <Clock size={16} />
          {noShowCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#E85555', color: '#fff',
              fontSize: '9px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {noShowCount}
            </span>
          )}
        </button>
        <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl"
          style={{ background: '#161616', border: '1px solid #303030', color: '#C9A84C' }}>
          <Edit2 size={16} />
        </button>
      </div>

      {/* ── Card principal ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #303030' }}>

        <div style={{ padding: '20px 20px 18px' }}>

          {/* Avatar + nome + badge */}
          <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(123,28,58,0.3), rgba(201,168,76,0.3))', border: '1px solid rgba(201,168,76,0.2)' }}>
              <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>
                {(currentClient.contact_name || currentClient.company_name)?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold" style={{ color: '#EFEFEF' }}>{currentClient.contact_name || '—'}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6560' }}>
                {[currentClient.contact_role, currentClient.company_name].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span className="text-xs font-semibold rounded-lg flex-shrink-0"
                style={{ padding: '4px 10px', background: stage.bg, color: stage.color, whiteSpace: 'nowrap' }}>
                {stage.label}
              </span>
              {noShowCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#E85555' }}>
                  🚫 {noShowCount}x nao apareceu
                </span>
              )}
              {cancelCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#F97316' }}>
                  📵 {cancelCount}x cancelou
                </span>
              )}
            </div>
          </div>

          {/* Infos de contato */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {currentClient.phone && (
              <a href={`tel:${currentClient.phone}`} className="flex items-center gap-2.5 text-sm"
                style={{ color: '#6B6560' }}>
                <Phone size={14} style={{ color: '#C9A84C' }} />
                {currentClient.phone}
              </a>
            )}
            {(currentClient.city || currentClient.address_street) && (() => {
              const parts = [
                currentClient.address_street,
                currentClient.address_number,
                currentClient.address_neighborhood,
                currentClient.city,
              ].filter(Boolean)
              const addressText = parts.join(', ')
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
              return (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2.5 text-sm" style={{ color: '#6B6560' }}>
                  <MapPin size={14} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#C9A84C44' }}>
                    {addressText}
                  </span>
                </a>
              )
            })()}
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

            {/* Estágio */}
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
                    <button key={key}
                      onClick={() => key === 'cancelado' ? setPendingStage('cancelado') : updateStage(key)}
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

            {/* Vendedor */}
            <div className="flex items-center gap-2.5 text-sm">
              <UserCheck size={14} style={{ color: '#C9A84C' }} />
              <span style={{ color: '#6B6560' }}>Vendedor: </span>
              {currentClient.assigned_to ? (
                <span className="text-xs font-semibold rounded-full"
                  style={{ padding: '4px 12px', background: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  {assignedName || '...'}
                </span>
              ) : (
                <span className="text-xs font-semibold" style={{ color: '#E8834A' }}>⚠️ Nao atribuido</span>
              )}
            </div>

            {/* Treinamento de interesse */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040' }}>
                Treinamento de interesse
              </p>
              <div className="flex flex-wrap" style={{ gap: '6px' }}>
                {TRAININGS_INTERESSE.map(t => {
                  const selected = (currentClient.treinamentos_interesse || []).includes(t)
                  return (
                    <button key={t} onClick={() => toggleTreinamentoInteresse(t)}
                      className="text-xs font-semibold rounded-full transition-all"
                      style={{
                        padding: '5px 12px',
                        background: selected ? 'rgba(201,168,76,0.12)' : 'transparent',
                        color: selected ? '#C9A84C' : '#444040',
                        border: `1px solid ${selected ? 'rgba(201,168,76,0.4)' : '#2A2A2A'}`,
                        cursor: 'pointer',
                      }}>
                      {selected ? '✓ ' : ''}{t}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Treinamentos matriculados — sempre visível */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040' }}>
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
                        color: selected ? '#4ADE80' : '#444040',
                        border: `1px solid ${selected ? 'rgba(74,222,128,0.4)' : '#2A2A2A'}`,
                        cursor: 'pointer',
                      }}>
                      {selected ? '✓ ' : ''}{t}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040' }}>Observações</p>
            {savingNotes && <p className="text-[10px]" style={{ color: '#6B6560' }}>Salvando...</p>}
            {notesSaved  && <p className="text-[10px]" style={{ color: '#4ADE80' }}>✓ Salvo</p>}
          </div>
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder="Nenhuma observação. Toque para adicionar..."
            rows={3}
            className="w-full text-sm outline-none resize-none rounded-xl transition-all"
            style={{ padding: '12px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', lineHeight: '1.6' }}
            onFocus={e => e.target.style.borderColor = '#C9A84C'}
            onBlur={e => { e.target.style.borderColor = '#252525'; saveNotes() }}
          />
        </div>

        {/* Visita agendada */}
        {currentClient.visit_scheduled_at && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>Visita agendada</p>
            <p className="text-sm font-semibold" style={{ color: '#4ADE80' }}>
              {new Date(currentClient.visit_scheduled_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              {' às '}
              {new Date(currentClient.visit_scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* Botão de sincronização com Google Agenda */}
            {profile?.google_refresh_token && (
              <div style={{ marginTop: '10px' }}>
                {currentClient.google_calendar_event_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} style={{ color: '#4ADE80' }} />
                    <span style={{ fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>
                      Salvo no Google Agenda
                    </span>
                  </div>
                ) : (
                  <button onClick={syncCalendarEvent} disabled={syncingCalendar}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 12px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(201,168,76,0.08)', color: '#C9A84C',
                      border: '1px solid rgba(201,168,76,0.2)',
                      fontSize: '12px', fontWeight: 600,
                    }}>
                    <Calendar size={12} />
                    {syncingCalendar ? 'Adicionando...' : 'Adicionar ao Google Agenda'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lembrete */}
        {currentClient.reminder_config && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>Lembrete</p>
            <div className="flex items-center gap-2">
              <span style={{ color: '#C9A84C' }}>🔔</span>
              <p className="text-xs font-medium" style={{ color: '#6B6560' }}>{formatReminder(currentClient.reminder_config)}</p>
            </div>
          </div>
        )}

        {/* Contador de visitas */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #222' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#333030' }}>Visitas realizadas</p>
              <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: '#EFEFEF', letterSpacing: '-1px' }}>
                {visits.length}
                <span className="text-sm font-normal ml-2" style={{ color: '#6B6560' }}>
                  {visits.length === 1 ? 'visita' : 'visitas'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={removeLastVisit} disabled={visits.length === 0}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: '#111', border: '1px solid #2A2A2A', color: visits.length === 0 ? '#252525' : '#6B6560' }}>
                <Minus size={16} />
              </button>
              <button onClick={addVisit} disabled={addingVisit}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', boxShadow: '0 2px 12px rgba(201,168,76,0.25)' }}>
                <Plus size={18} color="#F0EAD6" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex p-1 rounded-xl gap-1" style={{ background: '#161616', border: '1px solid #303030' }}>
        {['visitas', 'tarefas'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'rgba(201,168,76,0.12)' : 'transparent',
              color:      tab === t ? '#C9A84C' : '#6B6560',
              border:     tab === t ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {t === 'visitas' ? `Visitas (${visits.length})` : `Tarefas (${tasks.length})`}
          </button>
        ))}
      </div>

      {/* ── Tab: Visitas ── */}
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
                        <input type="date" defaultValue={v.visit_date} autoFocus
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {v.rating && (() => {
                      const r = RATINGS.find(r => r.key === v.rating)
                      return r ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: r.bg, color: r.color }}>
                          {r.label}
                        </span>
                      ) : null
                    })()}
                    <button onClick={() => deleteVisit(v.id)}>
                      <Trash2 size={14} style={{ color: '#2A2A2A' }} />
                    </button>
                  </div>
                </div>
                {v.visit_notes && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#111', borderRadius: '10px', border: '1px solid #1E1E1E' }}>
                    <p style={{ fontSize: '11px', color: '#6B6560', fontStyle: 'italic' }}>"{v.visit_notes}"</p>
                  </div>
                )}
                {(v.outcome || v.next_step || v.notes) && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #222' }}>
                    {v.outcome   && <p className="text-xs" style={{ color: '#6B6560' }}><span style={{ color: '#EFEFEF' }}>Resultado:</span> {v.outcome}</p>}
                    {v.next_step && <p className="text-xs mt-1" style={{ color: '#6B6560' }}><span style={{ color: '#EFEFEF' }}>Próximo passo:</span> {v.next_step}</p>}
                    {v.notes     && <p className="text-xs italic mt-1" style={{ color: '#333030' }}>"{v.notes}"</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Tarefas ── */}
      {tab === 'tarefas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#333030' }}>Follow-ups</p>
            <button onClick={() => setShowTarefaForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#C9A84C' }}>
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
                  style={{ borderColor: t.completed ? '#4ADE80' : '#2A2A2A', background: t.completed ? 'rgba(74,222,128,0.15)' : 'transparent' }}>
                  {t.completed && <span style={{ color: '#4ADE80', fontSize: '11px' }}>✓</span>}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: t.completed ? '#3A3530' : '#EFEFEF', textDecoration: t.completed ? 'line-through' : 'none' }}>
                    {t.title}
                  </p>
                  {t.due_date && <p className="text-xs mt-0.5" style={{ color: '#E8834A' }}>{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>}
                </div>
                <button onClick={() => deleteTask(t.id)}>
                  <Trash2 size={14} style={{ color: '#2A2A2A' }} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Histórico (painel deslizante) ── */}
      {showHistory && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false) }}>
          <div style={{
            background: '#0E0E0E', borderRadius: '24px 24px 0 0',
            border: '1px solid #252525', borderBottom: 'none',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#252525' }} />
            </div>

            {/* Header do painel */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#EFEFEF' }}>Histórico</p>
                <p style={{ fontSize: '11px', color: '#3A3A3A', marginTop: '2px' }}>
                  {currentClient.contact_name || currentClient.company_name}
                  {noShowCount > 0 && (
                    <span style={{ color: '#E85555', fontWeight: 600 }}> · 🚫 {noShowCount}x nao apareceu</span>
                  )}
                  {cancelCount > 0 && (
                    <span style={{ color: '#F97316', fontWeight: 600 }}> · 📵 {cancelCount}x cancelou</span>
                  )}
                </p>
              </div>
              <button onClick={() => setShowHistory(false)}
                style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#1A1A1A', border: '1px solid #252525', color: '#6B6560', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Timeline */}
            <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1 }}>
              {timelineItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontSize: '13px', color: '#2A2A2A' }}>Nenhum evento registrado ainda</p>
                </div>
              ) : (
                timelineItems.map((event, i) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    isLast={i === timelineItems.length - 1}
                    onDelete={handleDeleteEvent}
                    onEdit={handleEditEvent}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar cancelamento ── */}
      {pendingStage === 'cancelado' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
          onClick={e => { if (e.target === e.currentTarget) setPendingStage(null) }}>
          <div style={{
            background: '#111', borderRadius: '24px',
            border: '1px solid #303030',
            width: '100%', maxWidth: '360px',
            padding: '28px 24px 24px',
          }}>
            {/* Ícone */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', marginBottom: '18px',
            }}>
              📵
            </div>
            {/* Título */}
            <p style={{ fontSize: '17px', fontWeight: 700, color: '#EFEFEF', marginBottom: '8px' }}>
              Confirmar cancelamento
            </p>
            {/* Subtítulo */}
            <p style={{ fontSize: '13px', color: '#6B6560', lineHeight: 1.5, marginBottom: '24px' }}>
              Registrar que <span style={{ color: '#EFEFEF', fontWeight: 600 }}>
                {currentClient.contact_name || currentClient.company_name}
              </span> cancelou a visita? Isso ficará salvo no histórico.
            </p>
            {/* Botões */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setPendingStage(null)}
                style={{
                  flex: 1, padding: '13px', borderRadius: '14px',
                  fontSize: '14px', fontWeight: 600,
                  background: '#1A1A1A', color: '#6B6560',
                  border: '1px solid #2A2A2A', cursor: 'pointer',
                }}>
                Voltar
              </button>
              <button
                onClick={() => { updateStage('cancelado'); setPendingStage(null) }}
                style={{
                  flex: 1, padding: '13px', borderRadius: '14px',
                  fontSize: '14px', fontWeight: 600,
                  background: 'rgba(249,115,22,0.12)', color: '#F97316',
                  border: '1px solid rgba(249,115,22,0.3)', cursor: 'pointer',
                }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Painel de avaliação de visitas ── */}
      {showRating && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowRating(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: '#0E0E0E', borderRadius: '24px 24px 0 0', border: '1px solid #252525', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header do painel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 0' }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#EFEFEF' }}>Avaliação de Visitas</p>
                <p style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>
                  {canRate ? 'Preencha sua avaliação de cada visita' : 'Somente o responsável pode avaliar'}
                </p>
              </div>
              <button onClick={() => setShowRating(false)}
                style={{ background: 'none', border: 'none', color: '#6B6560', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Lista de visitas */}
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {visits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ color: '#3A3A3A', fontSize: '13px', fontWeight: 600 }}>Nenhuma visita registrada ainda</p>
                  <p style={{ color: '#2A2A2A', fontSize: '11px', marginTop: '6px' }}>Use o botão + na tela do cliente para registrar a visita e poder avaliar</p>
                </div>
              )}
              {visits.map((v, i) => {
                const edit = ratingEdits[v.id] || { rating: v.rating || null, visit_notes: v.visit_notes || '' }
                const isSaving = savingRatingId === v.id
                return (
                  <div key={v.id} style={{ background: '#161616', borderRadius: '16px', border: '1px solid #252525', padding: '16px' }}>
                    {/* Data da visita */}
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3A3A3A', marginBottom: '12px' }}>
                      {i === 0 ? 'Visita mais recente' : `${visits.length - i}ª visita`} · {new Date(v.visit_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>

                    {/* Pills de nota */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
                      {RATINGS.map(r => {
                        const active = edit.rating === r.key
                        return (
                          <button key={r.key}
                            disabled={!canRate}
                            onClick={() => setRatingEdits(prev => ({ ...prev, [v.id]: { ...edit, rating: active ? null : r.key } }))}
                            style={{
                              padding: '10px 4px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                              cursor: canRate ? 'pointer' : 'default',
                              background: active ? r.bg : '#111',
                              color: active ? r.color : '#3A3A3A',
                              border: `1px solid ${active ? r.color + '55' : '#252525'}`,
                              transition: 'all 0.15s',
                            }}>
                            {r.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Campo de anotações */}
                    <textarea
                      value={edit.visit_notes}
                      readOnly={!canRate}
                      onChange={e => setRatingEdits(prev => ({ ...prev, [v.id]: { ...edit, visit_notes: e.target.value } }))}
                      placeholder={canRate ? 'Anotações pessoais sobre essa visita...' : 'Sem anotações'}
                      rows={3}
                      style={{
                        width: '100%', background: '#111', border: '1px solid #252525', borderRadius: '12px',
                        padding: '10px 12px', color: '#EFEFEF', fontSize: '13px', resize: 'none',
                        outline: 'none', lineHeight: 1.5, marginBottom: '12px',
                        color: canRate ? '#EFEFEF' : '#6B6560',
                      }}
                    />

                    {/* Botão salvar */}
                    {canRate && (
                      <button
                        onClick={() => saveVisitRating(v.id)}
                        disabled={isSaving}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer',
                          background: 'rgba(201,168,76,0.08)', color: '#C9A84C',
                          border: '1px solid rgba(201,168,76,0.2)',
                          opacity: isSaving ? 0.6 : 1,
                        }}>
                        {isSaving ? 'Salvando...' : 'Salvar avaliação'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      {showEdit && (
        <ClienteForm initialData={currentClient} onClose={() => setShowEdit(false)}
          onSaved={async () => {
            const { data } = await supabase.from('clients').select('*').eq('id', client.id).single()
            setCurrentClient(data)
            setNotesValue(data?.notes || '')
            setShowEdit(false)
            onUpdated?.()
          }} />
      )}
      {showTarefaForm && (
        <TarefaForm clientId={client.id} onClose={() => setShowTarefaForm(false)}
          onSaved={() => { setShowTarefaForm(false); fetchTasks() }} />
      )}
    </div>
  )
}
