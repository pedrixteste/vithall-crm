import { cn } from '../../lib/utils'

export function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border',
        hover && 'transition-all active:scale-[0.98] cursor-pointer',
        className
      )}
      style={{ background: '#161616', borderColor: '#303030' }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('flex items-center justify-between border-b gap-3', className)}
      style={{ borderColor: '#222222', padding: '20px 28px' }} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('p-8', className)} {...props}>
      {children}
    </div>
  )
}
