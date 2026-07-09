// Service worker AUTODESTRUTIVO.
// Uma versão antiga do app (vite-plugin-pwa/Workbox) registrou um service
// worker que ficava servindo a versão em cache — travando usuários numa
// versão antiga. Este arquivo substitui aquele SW: ele limpa todos os caches,
// se desregistra e recarrega as abas para carregarem a versão nova da rede.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch (e) { /* ignore */ }

    await self.registration.unregister()

    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      if (client.url) client.navigate(client.url)
    }
  })())
})
