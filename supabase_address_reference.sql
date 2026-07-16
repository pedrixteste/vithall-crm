-- Ponto de referência do endereço do cliente (obrigatório no form desde 16/07/2026)
alter table clients add column if not exists address_reference text;
