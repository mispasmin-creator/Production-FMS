const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

async function checkKycTables() {
  const tableNames = ["kyc", "kyc_products", "kyc_master", "lab_kyc", "master_kyc", "raw_materials"];
  for (const name of tableNames) {
    const { data, error } = await prodSupabase.from(name).select("*").limit(3);
    if (!error) {
      console.log(`FOUND TABLE '${name}'! Sample count/data:`, data ? data.length : 0);
      if (data && data.length > 0) {
        console.log(`Sample row from '${name}':`, Object.keys(data[0]));
      }
    } else {
      console.log(`Table '${name}' query error:`, error.message);
    }
  }
}

checkKycTables();
