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

const FIRM_MAP = {
  "Purab": "PURAB ORDER",
  "Pmmpl": "PMMPL ORDER",
  "Rkl": "RKL ORDER"
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

// Updated getFirmMatchValues (same as we put in chemical-test, check, lab-testing1)
const getFirmMatchValues = (firm) => {
  const firms = String(firm || "").split(',').map(f => f.trim()).filter(Boolean);
  return firms.flatMap(rawFirm => {
    const mappedFirm = Object.entries(FIRM_MAP).find(
      ([key, value]) => normalizeKey(key) === normalizeKey(rawFirm) || normalizeKey(value) === normalizeKey(rawFirm)
    )?.[1] || "";
    return [rawFirm, mappedFirm]
      .map((value) => normalizeKey(value))
      .filter(Boolean);
  });
};

async function testUser(username, firm, role) {
  console.log(`\n--- Verification for user ${username} (Firm: ${firm}, Role: ${role}) ---`);
  
  const { data: actualProductionData, error: err } = await supabase.from('actual_production').select('*');
  if (err) {
    console.error('Error:', err);
    return;
  }

  // Simulator for chemical-test, check, lab-testing1
  const firmSearchValues = getFirmMatchValues(firm);
  const isAdmin = role?.toLowerCase() === "admin";
  const filterByFirm1 = (list) => {
    if (isAdmin || firmSearchValues.length === 0) return list;
    return list.filter((item) => {
      const firmName = normalizeKey(item["FIRM Name"]);
      return firmSearchValues.some((firmSearch) => firmName.includes(firmSearch) || firmSearch.includes(firmName));
    });
  };

  // Simulator for lab-testing2, pi-approval, management-app, composition-qc
  const userFirms = firm ? firm.split(',').map(f => f.trim()).filter(Boolean) : [];
  const filterByFirm2 = (list) => {
    if (isAdmin || userFirms.length === 0) return list;
    return list.filter((item) => {
      const fName = String(item["FIRM Name"] || "").toLowerCase();
      return userFirms.some(uf => {
        const firmSearch = uf.toLowerCase();
        const mappedFirmLower = (FIRM_MAP[uf] || uf).toLowerCase();
        return fName.includes(firmSearch) || fName.includes(mappedFirmLower);
      });
    });
  };

  const filtered1 = filterByFirm1(actualProductionData || []);
  const filtered2 = filterByFirm2(actualProductionData || []);
  
  console.log(`Total rows before filter: ${actualProductionData.length}`);
  console.log(`Method 1 (getFirmMatchValues) filtered: ${filtered1.length}`);
  console.log(`Method 2 (userFirms.some) filtered: ${filtered2.length}`);
}

async function main() {
  await testUser("kundan", "Pmmpl, Purab, Rkl", "user");
}

main();
