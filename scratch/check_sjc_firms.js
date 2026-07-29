const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function checkSjcFirms() {
  const { data: sjcData } = await prodSupabase
    .from("semi_job_card")
    .select("*")
    .in("SJC-Sr No.", ["SJC-381", "SJC-396", "SJC-397", "SJC-398"]);

  console.log("=== semi_job_card rows ===");
  (sjcData || []).forEach(r => {
    console.log(`SJC: "${r['SJC-Sr No.']}", SF: "${r['Semi Finished Production No.']}", Product: "${r['Product Name']}"`);
  });

  const { data: sfData } = await prodSupabase
    .from("semi_production")
    .select("*")
    .in("SF-Sr No.", ["SF-1", "SF-9"]);

  console.log("\n=== semi_production rows ===");
  (sfData || []).forEach(r => {
    console.log(`SF: "${r['SF-Sr No.']}", Name: "${r['Name Of Semi Finished Good']}", Firm name: "${r['Firm name']}", Firm Name: "${r['Firm Name']}"`);
  });
}

checkSjcFirms();
