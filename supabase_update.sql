-- Colunas adicionadas anteriormente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS origin text;

-- Novas colunas
ALTER TABLE clients ADD COLUMN IF NOT EXISTS matricula_stage text DEFAULT 'nao_marcou';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_location text;
