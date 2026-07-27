// Nome de usuário do robô criado no @BotFather, SEM o @.
//
// Enquanto estiver vazio o canal fica desligado: o cartão nem aparece no
// Perfil e as edge functions não mandam nada (elas checam o token próprio).
// Basta preencher aqui e subir o app para ligar.
export const TELEGRAM_BOT = 'vithall_crm_bot'

// O `start` leva o id da pessoa até o robô, que devolve pra gente o chat_id
// dela — é assim que a ligação acontece sozinha, sem ninguém copiar código.
export const linkConectarTelegram = (userId) =>
  TELEGRAM_BOT && userId ? `https://t.me/${TELEGRAM_BOT}?start=${userId}` : null
