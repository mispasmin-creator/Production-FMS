const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectAllGbxtActuals() {
  const { data: rows } = await prodSupabase.from("semi_actual").select("*");

  const gbxtRows = (rows || []).filter(r => String(r["Product Name"] || "").toLowerCase().includes("gbxt 74 fines"));

  console.log(`Found ${gbxtRows.length} rows for GBXT 74 Fines in semi_actual:\n`);

  for (const r of gbxtRows) {
    console.log(`----------------------------------------`);
    console.log(`ID: ${r.id}, SNo: ${r['S No.']}, TS: ${r.Timestamp}`);
    console.log(`Product Name: "${r['Product Name']}"`);
    console.log(`SJC No: "${r['Semi Finished Job Card No.']}"`);
    console.log(`SF No: "${r['Semi Finished Production No.']}"`);
    console.log(`Direct Firm name: "${r['Firm name']}"`);
    console.log(`Direct Firm Name: "${r['Firm Name']}"`);
    console.log(`Processing Cost: ${r['Processing Cost']}`);
  }
}

inspectAllGbxtActuals();
