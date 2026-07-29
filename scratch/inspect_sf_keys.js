const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectKeys() {
  const [
    { data: sfProdData },
    { data: sjcData }
  ] = await Promise.all([
    prodSupabase.from("semi_production").select("*").limit(3),
    prodSupabase.from("semi_job_card").select("*").limit(3)
  ]);

  console.log("semi_production keys:", Object.keys((sfProdData && sfProdData[0]) || {}));
  console.log("semi_production row 0:", sfProdData && sfProdData[0]);
  console.log("\nsemi_job_card keys:", Object.keys((sjcData && sjcData[0]) || {}));
  console.log("semi_job_card row 0:", sjcData && sjcData[0]);
}

inspectKeys();
