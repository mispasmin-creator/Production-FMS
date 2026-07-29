const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectSF9() {
  const { data: sf9 } = await prodSupabase.from("semi_production").select("*").eq("SF-Sr No.", "SF-9");
  console.log("semi_production SF-9 rows:\n", sf9);
}

inspectSF9();
