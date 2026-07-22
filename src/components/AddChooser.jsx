import { UserPlus, PhoneCall, CheckSquare } from 'lucide-react'

// Menu que aparece ao tocar no "+": escolher entre cadastrar um cliente
// normal, registrar um "pediu para ligar depois" ou criar uma tarefa solta.
export default function AddChooser({ onNewClient, onNewCallback, onNewTask, onClose }) {
  const opt = (Icon, title, desc, color, onClick) => (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
      style={{ background: '#161616', border: '1px solid #303030', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ width: '46px', height: '46px', background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: '#EFEFEF' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#6B6560', lineHeight: 1.4 }}>{desc}</p>
      </div>
    </button>
  )

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-lg slide-up sm:animate-in"
        style={{ background: '#1A1A1A', border: '1px solid #252525', borderRadius: '20px 20px 0 0', padding: '20px' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: '#6B6560' }}>O que você quer adicionar?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {opt(UserPlus, 'Adicionar novo cliente', 'Cadastro completo na lista de clientes', '#C9A84C', onNewClient)}
          {opt(PhoneCall, 'Cliente pediu p/ ligar depois', 'Só um lembrete de ligação, fora da lista', '#E8834A', onNewCallback)}
          {opt(CheckSquare, 'Nova tarefa', 'Lembrete com dia, hora e urgência', '#22D3EE', onNewTask)}
        </div>
      </div>
    </div>
  )
}
