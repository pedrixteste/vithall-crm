import { cn } from '../../lib/utils'
import { forwardRef } from 'react'

export const Input = forwardRef(function Input({ label, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: '#6B6560' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all',
          'placeholder:text-[#333030]',
          className
        )}
        style={{
          background: '#111111',
          border: '1px solid #252525',
          color: '#EFEFEF',
        }}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = '#252525'}
        {...props}
      />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: '#6B6560' }}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn('w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all resize-none placeholder:text-[#333030]', className)}
        style={{ background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = '#252525'}
        {...props}
      />
    </div>
  )
})

export const Select = forwardRef(function Select({ label, children, className, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: '#6B6560' }}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn('w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer', className)}
        style={{ background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
        onFocus={e => e.target.style.borderColor = '#C9A84C'}
        onBlur={e => e.target.style.borderColor = '#252525'}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
