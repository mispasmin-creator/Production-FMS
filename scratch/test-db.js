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

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || '';
const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('semi_actual')
    .delete()
    .in('id', [90, 91, 92]);
  if (error) {
    console.error(error);
  } else {
    console.log('Successfully deleted duplicate entries with IDs 90, 91, 92:', data);
  }
}

main();
