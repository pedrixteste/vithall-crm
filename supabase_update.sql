-- Adicionar novas colunas na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS origin text;
