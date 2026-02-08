-- Operators: Core resource
CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shift_id TEXT NOT NULL, 
    qualifications JSONB DEFAULT '[]'::jsonb, 
    training_data JSONB DEFAULT '{}'::jsonb,
    is_agency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotas: Daily/Shift assignments
CREATE TABLE IF NOT EXISTS rotas (
    date DATE NOT NULL,
    shift_id TEXT NOT NULL,
    assignments JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, shift_id)
);

-- Production Plans: Line status per day
CREATE TABLE IF NOT EXISTS production_plans (
    date DATE PRIMARY KEY,
    line_status JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staffing Plans: Weekly upload data
CREATE TABLE IF NOT EXISTS staffing_plans (
    week_date DATE PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Permissive for MVP)
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_plans ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read operators') THEN
        CREATE POLICY "Allow public read operators" ON operators FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public write operators') THEN
        CREATE POLICY "Allow public write operators" ON operators FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update operators" ON operators FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read rotas') THEN
        CREATE POLICY "Allow public read rotas" ON rotas FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public write rotas') THEN
        CREATE POLICY "Allow public write rotas" ON rotas FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update rotas" ON rotas FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read production_plans') THEN
        CREATE POLICY "Allow public read production_plans" ON production_plans FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public write production_plans') THEN
        CREATE POLICY "Allow public write production_plans" ON production_plans FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update production_plans" ON production_plans FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read staffing_plans') THEN
        CREATE POLICY "Allow public read staffing_plans" ON staffing_plans FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public write staffing_plans') THEN
        CREATE POLICY "Allow public write staffing_plans" ON staffing_plans FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update staffing_plans" ON staffing_plans FOR UPDATE USING (true);
    END IF;
END $$;
