// Recebe o "Iniciar" (/start) do robô do Telegram e liga a conversa à pessoa.
//
// Fluxo: o Perfil abre `https://t.me/<robo>?start=<user_id>`. O Telegram
// entrega esse `user_id` como parâmetro do /start, e aqui a gente guarda o
// `chat_id` no profile — sem ninguém precisar copiar código nem informar
// nada manualmente.
//
// Registrar o webhook (uma vez, depois de criar o robô):
//   POST para esta function com {"setup": "<TELEGRAM_WEBHOOK_SECRET>"}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BOT_TOKEN            = Deno.env.get('TELEGRAM_BOT_TOKEN')!
// O endpoint é público na internet. O Telegram devolve este segredo em todo
// update (header abaixo), então quem não souber dele não consegue forjar um
// "conectei fulano" e sequestrar as notificações de outra pessoa.
const WEBHOOK_SECRET       = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function responder(chatId: number, texto: string) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
  }).catch(() => {})
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))

    // ── Registro do webhook (chamado por nós, uma vez) ──
    if (body.setup) {
      if (body.setup !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401 })
      }
      const r = await fetch(`${API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${SUPABASE_URL}/functions/v1/telegram-webhook`,
          secret_token: WEBHOOK_SECRET,
          allowed_updates: ['message'],
        }),
      })
      return new Response(await r.text(), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // ── Update vindo do Telegram ──
    if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401 })
    }

    const msg = body.message
    const chatId = msg?.chat?.id
    const texto = (msg?.text || '').trim()
    if (!chatId || !texto) return new Response('ok')

    // "/parar" desliga só ESTE aparelho — quem tem dois celulares continua
    // recebendo no outro.
    if (texto === '/parar' || texto === '/stop') {
      const { data: ligados } = await sb.from('profiles')
        .select('id, telegram_chat_ids')
        .contains('telegram_chat_ids', [String(chatId)])
      for (const perfil of ligados || []) {
        await sb.from('profiles')
          .update({ telegram_chat_ids: (perfil.telegram_chat_ids || []).filter((c: string) => c !== String(chatId)) })
          .eq('id', perfil.id)
      }
      await responder(chatId, 'Pronto, parei de mandar as notificações neste aparelho. Para voltar, use o botão <b>Conectar Telegram</b> no Perfil do app.')
      return new Response('ok')
    }

    if (!texto.startsWith('/start')) {
      await responder(chatId, 'Sou o robô de avisos do Vithall CRM. Para receber suas notificações aqui, abra o app em <b>Perfil</b> e toque em <b>Conectar Telegram</b>.')
      return new Response('ok')
    }

    // "/start <user_id>" — o parâmetro vem do link do Perfil.
    const userId = texto.split(/\s+/)[1] || ''
    if (!UUID.test(userId)) {
      await responder(chatId, 'Faltou saber quem é você. Abra o app em <b>Perfil</b> e toque em <b>Conectar Telegram</b> — assim eu consigo te identificar.')
      return new Response('ok')
    }

    const { data: perfil, error: erroBusca } = await sb.from('profiles')
      .select('name, telegram_chat_ids')
      .eq('id', userId)
      .single()

    if (erroBusca || !perfil) {
      await responder(chatId, 'Não encontrei esse usuário. Tente de novo pelo botão <b>Conectar Telegram</b> no Perfil do app.')
      return new Response('ok')
    }

    // ACRESCENTA o aparelho em vez de substituir: quem tem dois celulares com
    // números de Telegram diferentes recebe nos dois. Reconectar o mesmo
    // aparelho não duplica.
    const atuais: string[] = perfil.telegram_chat_ids || []
    const jaTinha = atuais.includes(String(chatId))
    if (!jaTinha) {
      const { error } = await sb.from('profiles')
        .update({ telegram_chat_ids: [...atuais, String(chatId)] })
        .eq('id', userId)
      if (error) {
        await responder(chatId, 'Deu um problema ao salvar aqui. Tente de novo pelo botão <b>Conectar Telegram</b> no Perfil do app.')
        return new Response('ok')
      }
    }

    const primeiro = (perfil.name || '').split(' ')[0]
    const total = jaTinha ? atuais.length : atuais.length + 1
    await responder(chatId,
      `✅ Conectado${primeiro ? `, ${primeiro}` : ''}!\n\n` +
      `A partir de agora seus avisos do Vithall chegam aqui: o resumo da manhã, ` +
      `lembrete de ligação e de tarefa.\n\n` +
      (total > 1 ? `Você está recebendo em <b>${total} aparelhos</b>.\n\n` : '') +
      `Para parar só neste aparelho, mande /parar.`)

    return new Response('ok')
  } catch (e) {
    // Erro devolvido como 200: o Telegram reenvia o update em caso de falha,
    // e um /start com defeito ficaria repetindo para sempre.
    console.error(e)
    return new Response('ok')
  }
})
