-- Telegram em mais de um aparelho por pessoa.
--
-- Antes era UM contato por perfil (`telegram_chat_id`), então quem tinha dois
-- celulares com números diferentes perdia o primeiro: o segundo "Iniciar"
-- gravava por cima. Agora é uma lista — cada aparelho vira mais um item, e a
-- notificação sai para todos.
alter table public.profiles
  add column if not exists telegram_chat_ids text[] not null default '{}';

-- Ninguém precisa reconectar: quem já estava ligado entra na lista.
update public.profiles
   set telegram_chat_ids = array[telegram_chat_id]
 where telegram_chat_id is not null
   and telegram_chat_ids = '{}';

-- ⚠️ `telegram_chat_id` (singular) fica no banco só para não quebrar nada
-- durante o deploy — depois desta versão ninguém mais lê nem escreve nele.
-- Pode ser removido numa limpeza futura:
--   alter table public.profiles drop column telegram_chat_id;
