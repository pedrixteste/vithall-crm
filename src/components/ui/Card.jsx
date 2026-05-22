import { cn } from '../../lib/utils'

export function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border',
        hover && 'transition-all active:scale-[0.98] cursor-pointer',
        className
      )}
      style={{ background: '#161616', borderColor: '#2A2A2A' }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('flex items-center justify-between px-6 py-4 border-b gap-3', className)}
      style={{ borderColor: '#222222' }} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  )
}
