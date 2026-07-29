const { createClient } = require('@supabase/supabase-js');

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const prodSupabase = createClient(prodUrl, prodAnonKey);

async function inspectColumns() {
  const { data: sfData } = await prodSupabase.from("semi_production").select("*").limit(5);
  console.log("semi_production sample rows:\n", sfData);

  const { data: sjcData } = await prodSupabase.from("semi_job_card").select("*").limit(5);
  console.log("semi_job_card sample rows:\n", sjcData);
}

inspectColumns();
