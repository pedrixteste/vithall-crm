-- ═══════════════════════════════════════════════════════════════════
-- Canal do Telegram
-- ═══════════════════════════════════════════════════════════════════
-- Por que: push de PWA não consegue acordar o Chrome quando o Android
-- entra em soneca — é limitação da plataforma, não configuração. E o push
-- do OneSignal tem prazo de validade: se não entrega na hora, DESCARTA.
-- Mensagem de Telegram chega por FCM nativo (acorda o aparelho, como
-- qualquer app de mensagem) e nunca é descartada — fica no servidor até o
-- celular conectar.
--
-- O `chat_id` é quem a pessoa é na conversa com o nosso robô. Ele é
-- preenchido sozinho pela edge function `telegram-webhook` quando a pessoa
-- aperta "Iniciar" pelo botão do Perfil.
alter table public.profiles
  add column if not exists telegram_chat_id text;

-- Serve para o app mostrar "conectado" no Perfil sem varrer a tabela.
create index if not exists profiles_telegram_idx
  on public.profiles (telegram_chat_id)
  where telegram_chat_id is not null;
