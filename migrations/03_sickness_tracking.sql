-- Migration: Sickness Tracking
-- Creates table to track operator sickness records

-- Create sickness_records table
CREATE TABLE IF NOT EXISTS sickness_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    week_date DATE NOT NULL,
    days_sick INTEGER NOT NULL CHECK (days_sick >= 0 AND days_sick <= 7),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(operator_id, shift_id, week_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sickness_week ON sickness_records(week_date);
CREATE INDEX IF NOT EXISTS idx_sickness_shift ON sickness_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_sickness_operator ON sickness_records(operator_id);
CREATE INDEX IF NOT EXISTS idx_sickness_created ON sickness_records(created_at DESC);

-- Enable Row Level Security
ALTER TABLE sickness_records ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (adjust as needed)
CREATE POLICY "Enable all access for authenticated users" ON sickness_records
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sickness_records_updated_at
    BEFORE UPDATE ON sickness_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE sickness_records IS 'Tracks operator sickness days per week for department-wide statistics';
