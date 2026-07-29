const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectGbxtFirms() {
  const [
    { data: semiActualData },
    { data: sjcData },
    { data: sfProdData }
  ] = await Promise.all([
    prodSupabase.from("semi_actual").select("*"),
    prodSupabase.from("semi_job_card").select("*"),
    prodSupabase.from("semi_production").select("*")
  ]);

  console.log("=== ALL semi_actual rows containing GBXT 74 Fines ===");

  // Build maps
  const sfFirmMap = new Map();
  (sfProdData || []).forEach(row => {
    if (row["SF-Sr No."]) sfFirmMap.set(row["SF-Sr No."], row["Firm name"] || row["Firm Name"]);
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach(row => {
    const sfNo = row["Semi Finished Production No."];
    const sjcNo = row["SJC-Sr No."];
    const firm = sfFirmMap.get(sfNo) || "";
    if (sjcNo) sjcFirmMap.set(sjcNo, { firm, productName: row["Product Name"] });
  });

  (semiActualData || []).forEach((row, i) => {
    const pName = String(row["Product Name"] || "");
    if (pName.toLowerCase().includes("gbxt 74 fines")) {
      const sjcNo = row["Semi Finished Job Card No."];
      const sjcInfo = sjcFirmMap.get(sjcNo) || {};
      console.log(`[Row ${i+1}] ID: ${row.id}`);
      console.log(`   Direct Firm in semi_actual: "${row['Firm name'] || row['Firm Name']}"`);
      console.log(`   SJC No: "${sjcNo}" -> SJC Firm: "${sjcInfo.firm}"`);
      console.log(`   Processing Cost: ${row['Processing Cost']}`);
      console.log(`   Timestamp: ${row['Timestamp']}`);
    }
  });
}

inspectGbxtFirms();
