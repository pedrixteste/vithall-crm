// Modal bottom sheet para mobile
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-lg flex flex-col slide-up sm:animate-in"
        style={{
          background: '#1A1A1A',
          border: '1px solid #252525',
          borderRadius: '20px 20px 0 0',
          maxHeight: '92vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-4 flex-shrink-0">
            <h2 className="text-base font-bold" style={{ color: '#EFEFEF' }}>{title}</h2>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: '#252525', color: '#6B6560' }}>
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
