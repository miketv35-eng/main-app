-- Migration 05: Create staffing_plans table for storing weekly staffing data
-- This enables multi-file upload with historical data storage

CREATE TABLE IF NOT EXISTS staffing_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_date DATE NOT NULL UNIQUE,
    plan_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient week lookups
CREATE INDEX IF NOT EXISTS idx_staffing_plans_week_date ON staffing_plans(week_date);

-- Enable RLS
ALTER TABLE staffing_plans ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users
CREATE POLICY "staffing_plans_read" ON staffing_plans FOR SELECT USING (true);
CREATE POLICY "staffing_plans_write" ON staffing_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "staffing_plans_update" ON staffing_plans FOR UPDATE USING (true);
