const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectRow226() {
  const { data: row } = await prodSupabase.from("semi_actual").select("*").eq("id", 226).single();
  console.log("semi_actual ID 226 details:\n", row);

  const { data: sjc } = await prodSupabase.from("semi_job_card").select("*").eq("SJC-Sr No.", "SJC-397").single();
  console.log("\nsemi_job_card SJC-397 details:\n", sjc);

  if (sjc) {
    const { data: sf } = await prodSupabase.from("semi_production").select("*").eq("SF-Sr No.", sjc["Semi Finished Production No."]).single();
    console.log("\nsemi_production details:\n", sf);
  }
}

inspectRow226();
