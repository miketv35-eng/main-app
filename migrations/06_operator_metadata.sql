-- Alternative: Create a separate operator_metadata table for start dates
-- This avoids modifying the operators table structure
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS operator_metadata (
    operator_id TEXT PRIMARY KEY,
    start_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE operator_metadata ENABLE ROW LEVEL SECURITY;

-- Allow all access (adjust as needed)
CREATE POLICY "operator_metadata_all" ON operator_metadata FOR ALL USING (true) WITH CHECK (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
