import { cn } from '../../lib/utils'

export function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border',
        hover && 'transition-all active:scale-[0.98] cursor-pointer',
        className
      )}
      style={{ background: '#1A1A1A', borderColor: '#252525' }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3.5 border-b gap-3', className)}
      style={{ borderColor: '#1C1C1C' }} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  )
}
