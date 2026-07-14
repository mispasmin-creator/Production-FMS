const { createClient } = require("@supabase/supabase-js");

const purchaseSupabase = createClient(
  "https://jcgmyvxcamstnhuwmemc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo"
);

async function run() {
  try {
    const { data, error } = await purchaseSupabase
      .from("LIFT-ACCOUNTS")
      .select("*")
      .not("Total Bags Qty", "is", null)
      .limit(10);

    if (error) throw error;

    console.log(`Found ${data.length} entries where Total Bags Qty is NOT null:`);
    data.forEach((row, i) => {
      console.log(`\nEntry ${i+1}:`);
      console.log(`  Firm Name: ${row["Firm Name"]}`);
      console.log(`  Raw Material Name: ${row["Raw Material Name"]}`);
      console.log(`  Rate: ${row["Rate"]}`);
      console.log(`  Total Bags Qty: ${row["Total Bags Qty"]}`);
    });

    const { data: allData, error: allErr } = await purchaseSupabase
      .from("LIFT-ACCOUNTS")
      .select("Raw Material Name")
      .limit(100);
    
    console.log("\nSome material names in LIFT-ACCOUNTS:");
    const names = [...new Set(allData.map(d => d["Raw Material Name"]))];
    console.log(names);

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
