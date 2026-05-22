import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CheckSquare, Square, Trash2 } from 'lucide-react'

export default function TarefasPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendentes')

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, clients(company_name)')
      .order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  async function deleteTask(id) {
    if (!confirm('Excluir tarefa?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  const filtered = tasks.filter(t =>
    filter === 'todas' ? true : filter === 'pendentes' ? !t.completed : t.completed
  )

  const isOverdue = (date) => date && new Date(date + 'T23:59:59') < new Date() && !tasks.find(t => t.due_date === date)?.completed

  const pendingCount = tasks.filter(t => !t.completed).length
  const doneCount = tasks.filter(t => t.completed).length

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C9A84C' }}>Gestão</p>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#F0EAD6' }}>Tarefas</h1>
        <p className="text-sm" style={{ color: '#7A7570' }}>
          {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} · {doneCount} concluída{doneCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex p-1 rounded-xl mb-5 gap-1" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
        {[
          { key: 'pendentes', label: 'Pendentes' },
          { key: 'concluidas', label: 'Concluídas' },
          { key: 'todas', label: 'Todas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === f.key ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: filter === f.key ? '#C9A84C' : '#7A7570',
              border: filter === f.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#1E1E1E', border: '1px dashed #2A2A2A' }}>
          <CheckSquare size={28} className="mx-auto mb-3" style={{ color: '#2A2A2A' }} />
          <p className="text-sm font-medium" style={{ color: '#3A3530' }}>Nenhuma tarefa aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const overdue = !t.completed && t.due_date && new Date(t.due_date + 'T23:59:59') < new Date()
            return (
              <div key={t.id} className="rounded-2xl p-4 flex items-start gap-3 transition-all"
                style={{
                  background: '#1E1E1E',
                  border: `1px solid ${overdue ? 'rgba(232,131,74,0.3)' : '#2A2A2A'}`,
                  opacity: t.completed ? 0.5 : 1,
                }}>
                <button onClick={() => toggleTask(t)} className="mt-0.5 flex-shrink-0">
                  {t.completed
                    ? <CheckSquare size={20} style={{ color: '#4ADE80' }} />
                    : <Square size={20} style={{ color: '#2A2A2A' }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{
                    color: t.completed ? '#3A3530' : '#F0EAD6',
                    textDecoration: t.completed ? 'line-through' : 'none',
                  }}>
                    {t.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#C9A84C' }}>
                    {t.clients?.company_name}
                  </p>
                  {t.due_date && (
                    <p className="text-xs mt-1 font-medium" style={{ color: overdue ? '#E8834A' : '#7A7570' }}>
                      {overdue ? '⚠ Atrasada · ' : ''}{new Date(t.due_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {t.notes && <p className="text-xs mt-1" style={{ color: '#3A3530' }}>{t.notes}</p>}
                </div>
                <button onClick={() => deleteTask(t.id)} className="flex-shrink-0 p-1">
                  <Trash2 size={15} style={{ color: '#2A2A2A' }} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
