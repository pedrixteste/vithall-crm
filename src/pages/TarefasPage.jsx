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

  const filtered = tasks.filter(t => filter === 'todas' ? true : filter === 'pendentes' ? !t.completed : t.completed)

  const isOverdue = (date) => date && new Date(date) < new Date() && date !== new Date().toISOString().split('T')[0]

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="pb-20 sm:pb-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Tarefas</h1>

      <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
        {['pendentes', 'concluidas', 'todas'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition capitalize ${filter === f ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
            {f === 'pendentes' ? 'Pendentes' : f === 'concluidas' ? 'Concluídas' : 'Todas'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Nenhuma tarefa encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 shadow-sm flex items-start gap-3
              ${t.completed ? 'border-gray-100 opacity-60' : isOverdue(t.due_date) ? 'border-red-200' : 'border-gray-100'}`}>
              <button onClick={() => toggleTask(t)} className="mt-0.5 flex-shrink-0">
                {t.completed
                  ? <CheckSquare size={20} className="text-green-500" />
                  : <Square size={20} className="text-gray-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {t.title}
                </p>
                <p className="text-xs text-blue-500 mt-0.5">{t.clients?.company_name}</p>
                {t.due_date && (
                  <p className={`text-xs mt-1 font-medium ${isOverdue(t.due_date) && !t.completed ? 'text-red-500' : 'text-gray-400'}`}>
                    {isOverdue(t.due_date) && !t.completed ? '⚠ ' : ''}
                    {new Date(t.due_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
                {t.notes && <p className="text-xs text-gray-400 mt-1">{t.notes}</p>}
              </div>
              <button onClick={() => deleteTask(t.id)} className="text-gray-200 hover:text-red-400 flex-shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
