import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { key: 'pre_vendas', label: 'Pre-vendas', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  { key: 'vendedor',   label: 'Vendedor',   color: '#C9A84C', bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.25)' },
  { key: 'gerente',    label: 'Gerente',    color: '#E8748A', bg: 'rgba(232,116,138,0.1)', border: 'rgba(232,116,138,0.25)' },
]

export default function EquipePage() {
  const { profile: myProfile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  async function changeRole(memberId, newRole) {
    setSaving(true)
    // Via função segura no servidor (confirma que quem chama é gerente)
    const { error } = await supabase.rpc('set_member_role', { member_id: memberId, new_role: newRole })
    setEditingId(null)
    setSaving(false)
    if (error) {
      alert('Não foi possível alterar o cargo: ' + error.message)
      return
    }
    await fetchMembers() // confirma do banco (não fica "otimista" mentindo)
  }

  const getRoleInfo = (roleKey) => ROLES.find(r => r.key === roleKey) || ROLES[0]

  if (myProfile?.role !== 'gerente') {
    return (
      <div className="text-center" style={{ padding: '64px 0' }}>
        <p className="text-3xl mb-4">🔒</p>
        <p className="text-sm font-medium" style={{ color: '#6B6560' }}>Acesso restrito ao gerente</p>
      </div>
    )
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Gestao</p>
        <h1 style={{ color: '#EFEFEF' }}>Equipe</h1>
      </div>

      <p className="text-xs" style={{ color: '#6B6560' }}>
        Toque no cargo de um membro para alterar a funcao dele.
      </p>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center" style={{ padding: '64px 0' }}>
          <p className="text-3xl mb-4">👥</p>
          <p className="text-sm" style={{ color: '#6B6560' }}>Nenhum membro encontrado</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {members.map(member => {
            const roleInfo = getRoleInfo(member.role)
            const isEditing = editingId === member.id
            const isMe = member.id === myProfile?.id

            return (
              <div key={member.id} className="rounded-2xl"
                style={{ background: '#161616', border: '1px solid #303030', padding: '16px 20px' }}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base"
                    style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
                    {member.name?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>
                        {member.name || 'Sem nome'}
                      </p>
                      {isMe && (
                        <span className="text-[10px] font-bold rounded-full"
                          style={{ padding: '2px 8px', background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                          Voce
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#444040' }}>
                      {member.email || ''}
                    </p>
                  </div>

                  {/* Role badge (clicavel so para outros) */}
                  {isMe ? (
                    <span className="text-xs font-semibold rounded-full flex-shrink-0"
                      style={{ padding: '5px 12px', background: roleInfo.bg, color: roleInfo.color, border: `1px solid ${roleInfo.border}` }}>
                      {roleInfo.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => setEditingId(isEditing ? null : member.id)}
                      disabled={saving}
                      className="text-xs font-semibold rounded-full flex-shrink-0 transition-all"
                      style={{
                        padding: '5px 12px',
                        background: roleInfo.bg,
                        color: roleInfo.color,
                        border: `1px solid ${roleInfo.border}`,
                        cursor: 'pointer',
                      }}>
                      {roleInfo.label} ▾
                    </button>
                  )}
                </div>

                {/* Seletor de role */}
                {isEditing && (
                  <div className="flex flex-wrap" style={{ gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #222' }}>
                    {ROLES.map(r => (
                      <button key={r.key} onClick={() => changeRole(member.id, r.key)}
                        disabled={saving}
                        className="text-xs font-semibold rounded-full transition-all"
                        style={{
                          padding: '6px 14px',
                          background: member.role === r.key ? r.bg : 'transparent',
                          color: r.color,
                          border: `1px solid ${member.role === r.key ? r.border : '#2A2A2A'}`,
                          cursor: 'pointer',
                        }}>
                        {member.role === r.key ? '✓ ' : ''}{r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info sobre os papeis */}
      <div className="rounded-2xl" style={{ background: '#111', border: '1px solid #1C1C1C', padding: '16px' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#333030' }}>Papeis</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { role: 'pre_vendas', desc: 'Cadastra clientes e agenda visitas. Ve somente seus proprios contatos.' },
            { role: 'vendedor',   desc: 'Realiza as visitas e fecha matriculas. Ve os clientes atribuidos a ele.' },
            { role: 'gerente',    desc: 'Ve todos os clientes e gerencia a equipe.' },
          ].map(({ role, desc }) => {
            const r = getRoleInfo(role)
            return (
              <div key={role} className="flex gap-3 items-start">
                <span className="text-xs font-bold rounded-full flex-shrink-0"
                  style={{ padding: '3px 10px', background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>
                  {r.label}
                </span>
                <p className="text-xs" style={{ color: '#444040' }}>{desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
