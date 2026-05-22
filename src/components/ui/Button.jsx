import { cn } from '../../lib/utils'

export function Button({ children, variant = 'primary', size = 'md', className, disabled, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none'

  const variants = {
    primary: 'text-[#F0EAD6]',
    secondary: 'bg-[#1A1A1A] text-[#EFEFEF] border border-[#252525] hover:bg-[#1F1F1F]',
    ghost: 'text-[#6B6560] hover:text-[#EFEFEF] hover:bg-[#1A1A1A]',
    danger: 'bg-[rgba(232,85,85,0.12)] text-[#E85555] border border-[rgba(232,85,85,0.2)] hover:bg-[rgba(232,85,85,0.2)]',
  }

  const sizes = {
    sm: 'text-xs px-3 py-2',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-sm px-5 py-3.5',
    icon: 'p-2',
  }

  const sizeStyle = size === 'md' ? { paddingLeft: '14px', paddingRight: '14px' } : {}

  const primaryStyle = variant === 'primary' ? {
    background: 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)',
    boxShadow: '0 2px 12px rgba(201,168,76,0.2)',
  } : {}

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      style={{ ...primaryStyle, ...sizeStyle }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
