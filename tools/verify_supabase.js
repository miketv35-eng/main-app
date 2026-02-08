
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase credentials not found in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Testing Supabase connection...');

async function testConnection() {
    try {
        // Try to fetch a publicly readable table or just check session
        // Since we don't know exact table structure guaranteed, we'll try a simple health check or querying 'app_data' from checks
        const { data, error } = await supabase.from('app_data').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase Error:', error.message);
            process.exit(1);
        }

        console.log('Success! Connection established. Data accessible.');
    } catch (err) {
        console.error('Connection Error:', err);
        process.exit(1);
    }
}

testConnection();
