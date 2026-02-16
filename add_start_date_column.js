// Quick script to add start_date column to operators table
// Run with: node add_start_date_column.js

import { createClient } from '@supabase/supabase-js';

const SUPA_URL = "https://nuxntitedixiijtxzuni.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eG50aXRlZGl4aWlqdHh6dW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyMDQ3NzUsImV4cCI6MjA1NDc4MDc3NX0.FdLrPMGqVXBFIKPkxXZKJEBdWxQCZZTZpRkEfNjbAOo";

const supabase = createClient(SUPA_URL, SUPA_KEY);

async function addStartDateColumn() {
    console.log('🔧 Adding start_date column to operators table...');

    // Use Supabase's RPC to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
      ALTER TABLE operators ADD COLUMN IF NOT EXISTS start_date DATE;
      CREATE INDEX IF NOT EXISTS idx_operators_start_date ON operators(start_date);
    `
    });

    if (error) {
        console.error('❌ Error:', error.message);
        console.log('\n⚠️  This script requires a custom RPC function. Please run this SQL in Supabase SQL Editor instead:');
        console.log('\nALTER TABLE operators ADD COLUMN IF NOT EXISTS start_date DATE;');
        console.log('CREATE INDEX IF NOT EXISTS idx_operators_start_date ON operators(start_date);');
        console.log('NOTIFY pgrst, \'reload schema\';');
    } else {
        console.log('✅ Column added successfully!');
    }
}

addStartDateColumn();
