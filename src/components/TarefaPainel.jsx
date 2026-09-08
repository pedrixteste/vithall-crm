import { useState } from 'react'
import { Phone, Clock, Repeat, Calendar, User, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react'
import { urgencyColor, localDateStr, taskIsRecurring, taskRecurrenceLabel, taskDoneToday } from '../lib/utils'

// Painel da tarefa — abre ao tocar numa tarefa na aba Hoje ou no Dashboard.
// Mostra TUDO que a tarefa tem (texto completo, dia, hora, repetição,
// urgência, telefone, cliente, quando foi criada) e as ações: ligar, abrir a
// ficha, concluir / feita hoje, excluir (confirmação dentro do painel, sem
// pop-up do navegador).
//
//   task          — linha de `tasks` (com `clients` embutido, se tiver)
//   onComplete    — (task) → concluir / marcar feita hoje
//   onDelete      — (task) → excluir de vez (já confirmado aqui)
//   onOpenClient  — (client) → abrir a ficha (opcional)
function Linha({ Icon, cor = '#958E86', children }) {
  return (
    <p className="text-[13px] flex items-center gap-2" style={{ color: cor }}>
      <Icon size={13} style={{ flexShrink: 0 }} /> <span>{children}</span>
    </p>
  )
}

export default function TarefaPainel({ task, onClose, onComplete, onDelete, onOpenClient }) {
  const [confirmando, setConfirmando] = useState(false)
  if (!task) return null

  const repete  = taskRecurrenceLabel(task)
  const feito   = taskIsRecurring(task) && taskDoneToday(task)
  const overdue = task.due_date && task.due_date < localDateStr()
  const uColor  = typeof task.urgency === 'number' ? urgencyColor(task.urgency) : null
  const cliente = task.clients
  const nomeCliente = cliente?.contact_name || cliente?.company_name
  const dia = task.due_date
    ? new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')
    : null
  const criada = task.created_at
    ? new Date(task.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-lg slide-up sm:animate-in"
        style={{ background: '#1A1A1A', border: '1px solid #252525', borderRadius: '20px 20px 0 0', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>

        {/* Texto completo, sem cortar */}
        <p className="text-[12px] font-bold uppercase tracking-widest mb-1" style={{ color: '#E8834A' }}>Tarefa</p>
        <p className="text-[15px] font-semibold" style={{ color: '#EFEFEF', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{task.title}</p>
        {task.notes && (
          <p className="text-[13px] mt-2" style={{ color: '#B0A99F', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{task.notes}</p>
        )}

        {/* Etiquetas */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '10px' }}>
          {uColor && (
            <span className="text-[11px] font-bold rounded-full"
              style={{ padding: '2px 8px', background: `${uColor}1a`, color: uColor, border: `1px solid ${uColor}55` }}>
              urgência {task.urgency}
            </span>
          )}
          {repete && (
            <span className="text-[11px] font-bold rounded-full flex items-center gap-1"
              style={{ padding: '2px 8px', background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
              <Repeat size={9} /> {repete}
            </span>
          )}
          {feito && (
            <span className="text-[11px] font-bold rounded-full"
              style={{ padding: '2px 8px', background: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}>
              ✓ feita hoje
            </span>
          )}
        </div>

        {/* Detalhes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', padding: '12px 14px', background: '#161616', border: '1px solid #252525', borderRadius: '14px' }}>
          {dia && <Linha Icon={Calendar} cor={overdue ? '#E85555' : '#958E86'}>{overdue ? 'Venceu ' : 'Dia '}<span className="capitalize">{dia}</span></Linha>}
          {task.due_time && <Linha Icon={Clock}>{task.due_time.slice(0, 5)}{task.due_time ? ' · aviso 5 min antes' : ''}</Linha>}
          {task.phone && <Linha Icon={Phone} cor="#E8834A">{task.phone}</Linha>}
          {nomeCliente && <Linha Icon={User}>{nomeCliente}{cliente?.company_name && cliente.contact_name ? ` · ${cliente.company_name}` : ''}</Linha>}
          {criada && <Linha Icon={Clock}>Criada em {criada}</Linha>}
          {!dia && !task.due_time && !task.phone && !nomeCliente && !criada && (
            <p className="text-[12px]" style={{ color: '#6B6560' }}>Sem dia, hora ou telefone.</p>
          )}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          {task.phone && (
            <a href={'tel:' + task.phone.replace(/[^\d+]/g, '')}
              className="w-full text-left rounded-2xl flex items-center gap-3 transition-all active:scale-[0.98]"
              style={{ padding: '14px 16px', background: 'rgba(232,131,74,0.1)', border: '1px solid rgba(232,131,74,0.3)', textDecoration: 'none' }}>
              <Phone size={16} style={{ color: '#E8834A', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Ligar {task.phone}</p>
                <p className="text-[11px]" style={{ color: '#958E86' }}>Abre o discador com esse número</p>
              </div>
            </a>
          )}

          {cliente && onOpenClient && (
            <button type="button" onClick={() => { onClose(); onOpenClient(cliente) }}
              className="w-full text-left rounded-2xl flex items-center gap-3 transition-all active:scale-[0.98]"
              style={{ padding: '14px 16px', background: '#161616', border: '1px solid #303030' }}>
              <User size={16} style={{ color: '#C9A84C', flexShrink: 0 }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#EFEFEF' }}>Abrir ficha de {nomeCliente}</p>
              <ChevronRight size={14} style={{ color: '#958E86' }} />
            </button>
          )}

          <button type="button" onClick={() => { onComplete(task); onClose() }}
            className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: '#161616', border: '1px solid #303030', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ width: '40px', height: '40px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }}>✓</div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#EFEFEF' }}>
                {taskIsRecurring(task) ? (feito ? 'Desmarcar "feita hoje"' : 'Marcar como feita hoje') : 'Concluir tarefa'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#958E86', lineHeight: 1.4 }}>
                {taskIsRecurring(task) ? 'Some por hoje e volta na próxima vez' : 'Encerra a tarefa'}
              </p>
            </div>
          </button>

          {!confirmando ? (
            <button type="button" onClick={() => setConfirmando(true)}
              className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
              style={{ background: '#161616', border: '1px solid rgba(232,85,85,0.3)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ width: '40px', height: '40px', background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.25)', color: '#E85555' }}>
                <Trash2 size={16} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#E85555' }}>Excluir tarefa</p>
                <p className="text-xs mt-0.5" style={{ color: '#958E86', lineHeight: 1.4 }}>Para de aparecer de vez</p>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl" style={{ background: 'rgba(232,85,85,0.06)', border: '1px solid rgba(232,85,85,0.35)', padding: '14px 16px' }}>
              <p className="text-sm flex items-center gap-2" style={{ color: '#EFEFEF', lineHeight: 1.5 }}>
                <AlertTriangle size={15} style={{ color: '#E85555', flexShrink: 0 }} />
                Essa tarefa será <b>excluída</b> e o lembrete não vai mais aparecer.
              </p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setConfirmando(false)}
                  className="flex-1 text-xs font-semibold rounded-xl" style={{ padding: '11px', color: '#958E86', background: '#161616', border: '1px solid #303030' }}>
                  Cancelar
                </button>
                <button type="button" onClick={() => { onDelete(task); onClose() }}
                  className="flex-1 text-sm font-bold rounded-xl transition-all active:scale-95"
                  style={{ padding: '11px', background: 'rgba(232,85,85,0.12)', border: '1px solid #E85555', color: '#E85555' }}>
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
