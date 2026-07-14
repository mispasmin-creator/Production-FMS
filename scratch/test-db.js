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
  const { data, error } = await productionSupabase
    .from('actual_production')
    .select('id, "Job Card No.", "Actual1", "Actual2", "Actual3", "Status2", "Status3", "TestedBy1", "TestedBy2"');

  if (error) {
    console.error(error);
    return;
  }

  const targetRows = data.filter(r => (r.Actual2 !== null && r.Actual2 !== '') && (r.Status3 === null || r.Status3 === ''));

  console.log(`Untested Lab Test 2 Rows details (${targetRows.length} rows):`);
  targetRows.forEach(r => {
    console.log(`ID: ${r.id} | JC: ${r['Job Card No.']} | Status2 (LT1 Status): ${r.Status2} | Status3 (LT2 Status): ${r.Status3} | Actual1: ${r.Actual1} | Actual2: ${r.Actual2} | Actual3: ${r.Actual3} | TestedBy1: ${r.TestedBy1} | TestedBy2: ${r.TestedBy2}`);
  });
}

main();
