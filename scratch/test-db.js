const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const productionSupabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || '';
const productionSupabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';
const productionSupabase = createClient(productionSupabaseUrl, productionSupabaseAnonKey);

async function main() {
  // Query production table for id 106
  const { data: prodData, error: prodErr } = await productionSupabase
    .from('production')
    .select('*')
    .eq('id', 106);
  
  if (prodErr) {
    console.error('prodErr:', prodErr);
  } else {
    console.log('Production row with ID 106:', prodData[0]);
  }

  // Query actual_production table for Job Card JC-129
  const { data: actualData, error: actualErr } = await productionSupabase
    .from('actual_production')
    .select('*')
    .eq('"Job Card No."', 'JC-129');
  
  if (actualErr) {
    console.error('actualErr:', actualErr);
  } else {
    console.log('actual_production rows with Job Card JC-129:', actualData);
  }
}

main();
