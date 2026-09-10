-- ==============================================================================
-- G. H. Raisoni College of Engineering and Management, Wagholi, Pune
-- B.Tech Admissions: Authoritative Schema for Students & Branch Vacancies
-- ==============================================================================

-- 1. Branch Capacities (Administrator-controlled vacancy totals)
CREATE TABLE IF NOT EXISTS public.branch_capacities (
  branch TEXT PRIMARY KEY,
  il INTEGER NOT NULL DEFAULT 0,
  acap INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Initial Branch Capacities (Authoritative 9 Branches)
INSERT INTO public.branch_capacities (branch, il, acap) VALUES
  ('CIVIL', 0, 7),
  ('CSE', 36, 40),
  ('AI', 30, 11),
  ('DS', 12, 5),
  ('CY', 12, 2),
  ('IT', 12, 5),
  ('EE', 0, 16),
  ('ENTC', 0, 17),
  ('MECH', 0, 10)
ON CONFLICT (branch) DO UPDATE SET
  il = EXCLUDED.il,
  acap = EXCLUDED.acap,
  updated_at = NOW();

-- 2. Students & Allocations Table
CREATE TABLE IF NOT EXISTS public.students (
  application_id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  merit_no TEXT,
  allocated_branch_id TEXT,
  allocated_quota TEXT,
  allocated_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Pending',
  gender TEXT,
  category TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Row Level Security (RLS) configuration
ALTER TABLE public.branch_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read branch_capacities" ON public.branch_capacities FOR SELECT USING (true);
CREATE POLICY "Allow public write branch_capacities" ON public.branch_capacities FOR ALL USING (true);

CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public write students" ON public.students FOR ALL USING (true);

-- 4. Enable Supabase Realtime for automatic synchronization across Admin and Display
ALTER PUBLICATION supabase_realtime ADD TABLE public.branch_capacities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
