const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

async function checkCustomKycTable() {
  const { data, error } = await prodSupabase.from("custom_kyc_products").select("*").limit(1);
  if (error) {
    console.log("Error querying custom_kyc_products:", error.message);
    console.log("Table might need to be created via SQL or RPC.");
  } else {
    console.log("custom_kyc_products table exists! Data:", data);
  }
}

checkCustomKycTable();
