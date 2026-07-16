-- Quando a estrela (feedback da visita) foi preenchida — usado no aviso
-- "Feedbacks de visitas" da aba Hoje do pré-vendas
alter table visits add column if not exists rated_at timestamptz;
