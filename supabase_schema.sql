-- ============================================================
-- VITHALL CRM - Schema do banco de dados (Supabase)
-- Execute este SQL no Supabase > SQL Editor
-- ============================================================

-- Tabela de perfis dos vendedores
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de clientes/empresas
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_role TEXT DEFAULT 'Dono',
  phone TEXT,
  email TEXT,
  address TEXT,
  pipeline_stage TEXT DEFAULT 'lead' CHECK (pipeline_stage IN ('lead', 'negociacao', 'proposta', 'fechado')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de visitas
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  examples_shown TEXT[] DEFAULT '{}',
  outcome TEXT,
  next_step TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de tarefas
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) - usuários só veem dados deles
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê e edita apenas o próprio
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Clients: usuário autenticado vê todos os clientes da empresa
CREATE POLICY "clients_authenticated" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

-- Visits: usuário autenticado vê todas as visitas
CREATE POLICY "visits_authenticated" ON visits
  FOR ALL USING (auth.role() = 'authenticated');

-- Tasks: usuário autenticado vê todas as tarefas
CREATE POLICY "tasks_authenticated" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Trigger para criar perfil automaticamente ao criar usuário
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
