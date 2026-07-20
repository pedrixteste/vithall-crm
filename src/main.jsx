import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Remove service workers LEGADOS (o PWA antigo que prendia o app numa versão
// velha), mas PRESERVA o do OneSignal — ele entrega as notificações push e NÃO
// guarda cópia do app, então não traz o bug de cache de volta.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => {
      const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || ''
      if (!url.includes('OneSignalSDK')) r.unregister()
    }))
    .catch(() => {})
}

// Instalação como app (manifest, SEM service worker): o Chrome/Android dispara
// beforeinstallprompt cedo — guardamos o evento p/ o botão do Perfil usar.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__installPrompt = e
  window.dispatchEvent(new Event('installprompt-ready'))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
