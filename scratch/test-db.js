const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
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

async function testInsert(val) {
  console.log(`\n--- Testing insert of "${val}" into numeric column ---`);
  const { data, error } = await supabase
    .from('actual_production')
    .update({ "BDAt110C": val })
    .eq('id', 299) // update some existing test row
    .select();

  if (error) {
    console.error('Failed:', error);
  } else {
    console.log('Success:', data[0]["BDAt110C"]);
  }
}

async function main() {
  await testInsert("NaN");
  await testInsert("-999.99");
}

main();
