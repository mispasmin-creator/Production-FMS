const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://jcgmyvxcamstnhuwmemc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo'
);

async function run() {
  const { data: rows } = await s
    .from('LIFT-ACCOUNTS')
    .select('*')
    .order('Timestamp', { ascending: false });

  const matches = (rows || []).filter(
    (row) =>
      String(row['Raw Material Name'] || '').toLowerCase().includes('gbxt 80 (0-1)') &&
      String(row['Firm Name'] || '').toLowerCase().includes('pmmpl')
  );

  console.log(`Found ${matches.length} rows for Pmmpl GBXT 80 (0-1):`);
  matches.forEach((m, i) => {
    console.log(`[${i}] ID: ${m.id}, TS: ${m.Timestamp}, Al: ${m['Alumina Percent Age %']}, Fe: ${m['Iron Percent Age %']}, BD: ${m['BD Percent Age %']}, AP: ${m['AP Percent Age %']}, Rate: ${m.Rate}`);
  });
}
run();
