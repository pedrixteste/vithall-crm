import { cn } from '../../lib/utils'

const variants = {
  gold: { color: '#C9A84C', bg: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.2)' },
  bordo: { color: '#E8748A', bg: 'rgba(123,28,58,0.15)', border: 'rgba(123,28,58,0.3)' },
  purple: { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  green: { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)' },
  orange: { color: '#E8834A', bg: 'rgba(232,131,74,0.1)', border: 'rgba(232,131,74,0.2)' },
  muted: { color: '#6B6560', bg: 'rgba(107,101,96,0.1)', border: 'rgba(107,101,96,0.2)' },
}

export function Badge({ children, variant = 'muted', className }) {
  const v = variants[variant]
  return (
    <span
      className={cn('inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', className)}
      style={{ color: v.color, background: v.bg, borderColor: v.border }}
    >
      {children}
    </span>
  )
}

export const STAGE_BADGES = {
  lead: <Badge variant="muted">Lead</Badge>,
  negociacao: <Badge variant="gold">Em negociação</Badge>,
  proposta: <Badge variant="purple">Proposta enviada</Badge>,
  fechado: <Badge variant="green">Fechado ✓</Badge>,
}
