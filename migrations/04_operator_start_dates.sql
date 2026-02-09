-- Migration 04: Add start_date to operators for tenure-based sickness calculations
-- This enables 5-year rolling sickness rate with tenure adjustment

-- Add start_date column
ALTER TABLE operators ADD COLUMN IF NOT EXISTS start_date DATE;

-- Add index for performance on tenure queries
CREATE INDEX IF NOT EXISTS idx_operators_start_date ON operators(start_date);
