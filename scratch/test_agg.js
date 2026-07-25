const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://jcgmyvxcamstnhuwmemc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo'
);

async function testAggregation() {
  const { data: rawData } = await s
    .from('LIFT-ACCOUNTS')
    .select('*')
    .order('Timestamp', { ascending: false });

  // Map to hold aggregated record per firm+product key
  const recordMap = new Map();

  for (const row of rawData || []) {
    const firmName = String(row['Firm Name'] || 'N/A').trim();
    const productName = String(row['Raw Material Name'] || row['Product Name'] || 'N/A').trim();

    if (!firmName || !productName) continue;

    const key = `${firmName.toLowerCase()}___${productName.toLowerCase()}`;

    if (!recordMap.has(key)) {
      recordMap.set(key, {
        firmName,
        productName,
        alumina: null,
        iron: null,
        price: null,
        bd: null,
        ap: null,
        timestamp: row['Timestamp'],
      });
    }

    const rec = recordMap.get(key);

    if (rec.alumina === null && row['Alumina Percent Age %'] !== null && row['Alumina Percent Age %'] !== undefined) {
      rec.alumina = parseFloat(row['Alumina Percent Age %']);
    }
    if (rec.iron === null && row['Iron Percent Age %'] !== null && row['Iron Percent Age %'] !== undefined) {
      rec.iron = parseFloat(row['Iron Percent Age %']);
    }
    if (rec.bd === null && row['BD Percent Age %'] !== null && row['BD Percent Age %'] !== undefined) {
      rec.bd = parseFloat(row['BD Percent Age %']);
    }
    if (rec.ap === null && row['AP Percent Age %'] !== null && row['AP Percent Age %'] !== undefined) {
      rec.ap = parseFloat(row['AP Percent Age %']);
    }
    if (rec.price === null && row['Rate'] !== null && row['Rate'] !== undefined) {
      rec.price = parseFloat(row['Rate']);
    }
  }

  const result = [];
  for (const rec of recordMap.values()) {
    const alumina = rec.alumina || 0;
    const iron = rec.iron || 0;
    const price = rec.price || 0;
    const bd = rec.bd || 0;
    const ap = rec.ap || 0;

    const albd = Number((alumina * bd).toFixed(2));
    const ratePerAlumina = alumina > 0 ? Number((price / alumina).toFixed(2)) : 0;

    result.push({
      firmName: rec.firmName,
      productName: rec.productName,
      alumina,
      iron,
      price,
      bd,
      ap,
      albd,
      ratePerAlumina,
      timestamp: rec.timestamp,
    });
  }

  const pmmplGbxt = result.find(
    (r) => r.firmName.toLowerCase() === 'pmmpl' && r.productName.toLowerCase().includes('gbxt 80 (0-1)')
  );
  console.log('AGGREGATED RESULT FOR Pmmpl GBXT 80 (0-1):', pmmplGbxt);
}

testAggregation();
