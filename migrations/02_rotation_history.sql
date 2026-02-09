-- Migration: Add rotation history tracking
-- This table stores historical operator assignments for rotation balancing

CREATE TABLE IF NOT EXISTS rotation_history (
    id SERIAL PRIMARY KEY,
    operator_id TEXT NOT NULL,
    week_date DATE NOT NULL,
    area_id TEXT NOT NULL,
    hours_worked DECIMAL(5,2) DEFAULT 0,
    shift_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(operator_id, week_date, area_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rotation_operator ON rotation_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_rotation_week ON rotation_history(week_date);
CREATE INDEX IF NOT EXISTS idx_rotation_area ON rotation_history(area_id);
CREATE INDEX IF NOT EXISTS idx_rotation_shift ON rotation_history(shift_id);

-- Enable RLS
ALTER TABLE rotation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for MVP)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read rotation_history') THEN
        CREATE POLICY "Allow public read rotation_history" ON rotation_history FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public write rotation_history') THEN
        CREATE POLICY "Allow public write rotation_history" ON rotation_history FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update rotation_history" ON rotation_history FOR UPDATE USING (true);
    END IF;
END $$;
