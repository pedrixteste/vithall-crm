-- A trava clients_matricula_stage_check estava desatualizada: só aceitava
-- 6 estágios e faltavam 'marcado', 'cancelado' e o novo 'marcacao_futura'.
-- Recria com TODOS os estágios que o app usa (STAGES em ClienteDetalhe).
-- ⚠️ SEMPRE que adicionar um estágio novo no código, rodar isto antes.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_matricula_stage_check;

ALTER TABLE clients ADD CONSTRAINT clients_matricula_stage_check
  CHECK (matricula_stage = ANY (ARRAY[
    'nao_marcou'::text,
    'pediu_ligar'::text,
    'marcacao_futura'::text,
    'marcado'::text,
    'nao_visitado'::text,
    'nao_apareceu'::text,
    'cancelado'::text,
    'recebeu_visita'::text,
    'matriculado'::text
  ]));
