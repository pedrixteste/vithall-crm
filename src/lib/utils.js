import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Data LOCAL no formato YYYY-MM-DD. NÃO usar toISOString() para isso: ele
// converte p/ UTC e, entre 21h e meia-noite (Brasil), cai no dia seguinte.
export function localDateStr(d = new Date()) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
