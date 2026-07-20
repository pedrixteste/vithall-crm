-- Descrição opcional do "cliente pediu para ligar depois" — contexto para
-- lembrar na hora de ligar (aparece no card do Hoje).
alter table callbacks add column if not exists notes text;
