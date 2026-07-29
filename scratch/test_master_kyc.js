const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

async function testMasterKycFetch() {
  const { data: masterKycData, error } = await prodSupabase.from("kyc").select("*");
  if (error) {
    console.error("Error fetching master kyc:", error.message);
    return;
  }
  console.log(`Successfully fetched ${masterKycData.length} rows from Supabase 'kyc' table!`);
  masterKycData.slice(0, 5).forEach((row, idx) => {
    console.log(`[${idx+1}] Product: "${row["Product name"]}", Firm: "${row["Firm Name"]}", Alumina: ${row["Alumina"]}, Price: ₹${row["Price"]}`);
  });
}

testMasterKycFetch();
