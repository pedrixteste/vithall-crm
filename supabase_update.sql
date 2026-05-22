-- Colunas adicionadas anteriormente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS origin text;

-- Novas colunas
ALTER TABLE clients ADD COLUMN IF NOT EXISTS matricula_stage text DEFAULT 'nao_marcou';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_location text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_config jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onesignal_player_id text;

-- Hierarquia de papeis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'pre_vendas';
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id);
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS matriculas text[] DEFAULT '{}';

-- Correcao do nome do treinamento: LORAP → LORAPE
UPDATE clients
SET matriculas = array_replace(matriculas, 'LORAP', 'LORAPE')
WHERE 'LORAP' = ANY(matriculas);
