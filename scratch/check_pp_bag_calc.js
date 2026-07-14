const { createClient } = require("@supabase/supabase-js");

const purchaseSupabase = createClient(
  "https://jcgmyvxcamstnhuwmemc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo"
);

async function run() {
  try {
    const { data, error } = await purchaseSupabase
      .from("LIFT-ACCOUNTS")
      .select('"Firm Name", "Raw Material Name", "Lifting Qty", "Rate", "Total Bags Qty", "Timestamp"')
      .ilike("Firm Name", "Pmmpl")
      .ilike("Raw Material Name", "Pp Bag (50 kgs)")
      .order("Timestamp", { ascending: false })
      .limit(5);

    if (error) throw error;

    console.log("Pmmpl Pp Bag (50 kgs) entries:");
    data.forEach((row, i) => {
      console.log(`\nRow ${i+1}:`);
      console.log(`  Firm Name: ${row["Firm Name"]}`);
      console.log(`  Raw Material Name: ${row["Raw Material Name"]}`);
      console.log(`  Lifting Qty: ${row["Lifting Qty"]}`);
      console.log(`  Rate: ${row["Rate"]}`);
      console.log(`  Total Bags Qty: ${row["Total Bags Qty"]}`);
      console.log(`  Timestamp: ${row["Timestamp"]}`);
    });

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
