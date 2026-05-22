import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CheckSquare, Square, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'

export default function TarefasPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pendentes')

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks').select('*, clients(company_name)')
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
  const pendingCount = tasks.filter(t => !t.completed).length
  const doneCount = tasks.filter(t => t.completed).length

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-in space-y-7">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Gestão</p>
        <h1 style={{ color: '#EFEFEF' }}>Tarefas</h1>
        <p className="text-xs mt-2 tabular-nums" style={{ color: '#6B6560' }}>
          <span style={{ color: '#E8834A', fontWeight: 600 }}>{pendingCount}</span> pendente{pendingCount !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: '#4ADE80', fontWeight: 600 }}>{doneCount}</span> concluída{doneCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex p-1.5 rounded-xl gap-1.5" style={{ background: '#161616', border: '1px solid #303030' }}>
        {[
          { key: 'pendentes', label: 'Pendentes' },
          { key: 'concluidas', label: 'Concluídas' },
          { key: 'todas', label: 'Todas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === f.key ? 'rgba(201,168,76,0.1)' : 'transparent',
              color: filter === f.key ? '#C9A84C' : '#6B6560',
              border: filter === f.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ border: '1px dashed #222' }}>
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm" style={{ color: '#333030' }}>Nada aqui!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const overdue = !t.completed && t.due_date && new Date(t.due_date + 'T23:59:59') < new Date()
            return (
              <Card key={t.id}>
                <div className="flex items-start gap-5 px-7 py-6"
                  style={{ opacity: t.completed ? 0.4 : 1 }}>
                  <button onClick={() => toggleTask(t)} className="mt-0.5 flex-shrink-0 transition-all">
                    {t.completed
                      ? <CheckSquare size={20} style={{ color: '#4ADE80' }} />
                      : <Square size={20} style={{ color: '#333030' }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{
                      color: t.completed ? '#6B6560' : '#EFEFEF',
                      textDecoration: t.completed ? 'line-through' : 'none',
                    }}>
                      {t.title}
                    </p>
                    <p className="text-xs mt-1.5 font-medium" style={{ color: '#C9A84C' }}>
                      {t.clients?.company_name}
                    </p>
                    {t.due_date && (
                      <p className="text-xs mt-2 font-semibold tabular-nums" style={{ color: overdue ? '#E85555' : '#6B6560' }}>
                        {overdue ? '⚠ Atrasada · ' : '📅 '}{new Date(t.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {t.notes && <p className="text-xs mt-2" style={{ color: '#333030' }}>{t.notes}</p>}
                  </div>
                  <button onClick={() => deleteTask(t.id)} className="flex-shrink-0 p-1.5 -mr-1">
                    <Trash2 size={15} style={{ color: '#303030' }} />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
