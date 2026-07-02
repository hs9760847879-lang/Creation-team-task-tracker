-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')) DEFAULT 'agent',
  slack_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tasks table (task templates)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('default', 'custom')) DEFAULT 'custom',
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Remove duplicate tasks (keep only the first entry for each title)
DELETE FROM tasks WHERE id NOT IN (SELECT MIN(id) FROM tasks GROUP BY title);

-- Assignments table (task-to-agent connections)
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'pending_approval')) DEFAULT 'pending',
  task_count INTEGER DEFAULT 1,
  registered_by_agent BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  time_taken_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check admin role (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Function to calculate time taken on submit
CREATE OR REPLACE FUNCTION calculate_time_taken()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.started_at IS NOT NULL AND NEW.submitted_at IS NOT NULL THEN
      NEW.time_taken_minutes := EXTRACT(EPOCH FROM (NEW.submitted_at - NEW.started_at)) / 60;
    ELSIF OLD.created_at IS NOT NULL AND NEW.submitted_at IS NOT NULL THEN
      NEW.time_taken_minutes := EXTRACT(EPOCH FROM (NEW.submitted_at - OLD.created_at)) / 60;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_time_taken ON assignments;
CREATE TRIGGER trigger_calculate_time_taken
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION calculate_time_taken();

-- ============ RLS POLICIES ============

-- Profiles
DROP POLICY IF EXISTS profiles_self_select ON profiles;
CREATE POLICY profiles_self_select ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_select ON profiles;
CREATE POLICY profiles_admin_select ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS profiles_admin_insert ON profiles;
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS profiles_self_insert ON profiles;
CREATE POLICY profiles_self_insert ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (is_admin());

-- Tasks
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS tasks_admin_insert ON tasks;
CREATE POLICY tasks_admin_insert ON tasks
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS tasks_admin_update ON tasks;
CREATE POLICY tasks_admin_update ON tasks
  FOR UPDATE USING (is_admin());

-- Assignments
DROP POLICY IF EXISTS assignments_agent_select ON assignments;
CREATE POLICY assignments_agent_select ON assignments
  FOR SELECT USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS assignments_admin_select ON assignments;
CREATE POLICY assignments_admin_select ON assignments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS assignments_agent_insert ON assignments;
CREATE POLICY assignments_agent_insert ON assignments
  FOR INSERT WITH CHECK (
    auth.uid() = agent_id AND registered_by_agent = true
  );

DROP POLICY IF EXISTS assignments_admin_insert ON assignments;
CREATE POLICY assignments_admin_insert ON assignments
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS assignments_agent_update ON assignments;
CREATE POLICY assignments_agent_update ON assignments
  FOR UPDATE USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS assignments_admin_update ON assignments;
CREATE POLICY assignments_admin_update ON assignments
  FOR UPDATE USING (is_admin());

-- ============ SEED DATA ============

INSERT INTO tasks (title, type, is_active) VALUES
  ('Property Creation', 'default', true),
  ('Commission', 'default', true),
  ('Policy Framing', 'default', true),
  ('Policy Update', 'default', true)
ON CONFLICT (title) DO NOTHING;
