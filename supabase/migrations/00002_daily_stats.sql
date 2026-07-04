CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_commission_updated INTEGER DEFAULT 0,
  total_commission_created INTEGER DEFAULT 0,
  number_of_mails_assigned INTEGER DEFAULT 0,
  number_of_properties_created INTEGER DEFAULT 0,
  number_of_faqs_updated INTEGER DEFAULT 0,
  day_of_week TEXT,
  total_properties_api_enabled INTEGER DEFAULT 0,
  video_created INTEGER DEFAULT 0,
  stagging_property_creation INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS daily_agent_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  agent_name TEXT NOT NULL,
  commission_updated INTEGER DEFAULT 0,
  commission_created INTEGER DEFAULT 0,
  properties_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, agent_name)
);

ALTER TABLE daily_agent_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_stats
DROP POLICY IF EXISTS daily_stats_admin_all ON daily_stats;
CREATE POLICY daily_stats_admin_all ON daily_stats
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS daily_stats_agent_select ON daily_stats;
CREATE POLICY daily_stats_agent_select ON daily_stats
  FOR SELECT USING (true);

-- RLS policies for daily_agent_stats
DROP POLICY IF EXISTS daily_agent_stats_admin_all ON daily_agent_stats;
CREATE POLICY daily_agent_stats_admin_all ON daily_agent_stats
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS daily_agent_stats_agent_select ON daily_agent_stats;
CREATE POLICY daily_agent_stats_agent_select ON daily_agent_stats
  FOR SELECT USING (true);
